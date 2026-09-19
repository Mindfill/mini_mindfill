import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";
import { registerDevice, type DeviceInfo } from "@/lib/device";
import { acceptSubscriptionInvite } from "@/lib/api";
import { PENDING_INVITE_TOKEN_KEY } from "@/lib/pendingInvite";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
    /** Set when POST /devices/register comes back 403 — this browser is over
     * the 2-device cap. The app renders a blocking screen until resolved. */
    deviceLimit: DeviceInfo[] | null;
    /** Re-runs device registration (call after the user deregisters a device). */
    retryDeviceRegistration: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [deviceLimit, setDeviceLimit] = useState<DeviceInfo[] | null>(null);
    const lastRegisteredToken = useRef<string | null>(null);

    const runDeviceRegistration = (accessToken: string) => {
        // Fire-and-forget — a device-registration hiccup must never block sign-in,
        // and this must stay out of the synchronous onAuthStateChange callback.
        registerDevice(accessToken)
            .then((result) => {
                setDeviceLimit(result.ok ? null : (result.devices ?? []));
            })
            .catch((err) => {
                console.error("[auth] Device registration failed:", err);
            });
    };

    const runPendingInviteResolution = (accessToken: string) => {
        const token = localStorage.getItem(PENDING_INVITE_TOKEN_KEY);
        if (!token) return;
        // Fire-and-forget, same reasoning as device registration above. A 404
        // here just means a brand-new signup's post-signup hook already
        // resolved it server-side — not an error.
        acceptSubscriptionInvite(token, accessToken)
            .catch(() => {})
            .finally(() => localStorage.removeItem(PENDING_INVITE_TOKEN_KEY));
    };

    useEffect(() => {
        let mounted = true;

        // onAuthStateChange fires an INITIAL_SESSION event immediately on
        // subscribe with the current session, so we don't need a separate
        // getSession() call — avoiding a second, concurrent acquisition of the
        // gotrue Web Lock (which, under StrictMode's double-mount, produced the
        // "lock was not released within 5000ms" warning).
        //
        // Supabase also re-emits SIGNED_IN / TOKEN_REFRESHED every time the tab
        // regains focus. Only update state when the token actually changes,
        // otherwise a new session object reference would churn every consumer on
        // each tab switch (which unmounts in-flight UI like the upload modal).
        //
        // NOTE: keep this callback synchronous — never await other supabase auth
        // calls inside it, or it will deadlock on the same lock.
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            if (!mounted) return;
            setSession((prev) =>
                prev?.access_token === newSession?.access_token ? prev : newSession
            );
            setUser((prev) =>
                prev?.id === newSession?.user?.id ? prev : newSession?.user ?? null
            );
            setIsLoading(false);

            // Rotate the device token on an actual sign-in/signup action only —
            // SIGNED_IN does not fire for INITIAL_SESSION (a page reload merely
            // restoring an already-persisted session), so an ordinary reload
            // doesn't churn the token or hit this endpoint again.
            if (
                event === "SIGNED_IN" &&
                newSession?.access_token &&
                lastRegisteredToken.current !== newSession.user?.id
            ) {
                lastRegisteredToken.current = newSession.user?.id ?? null;
                runDeviceRegistration(newSession.access_token);
                runPendingInviteResolution(newSession.access_token);
            }
            if (event === "SIGNED_OUT") {
                lastRegisteredToken.current = null;
                setDeviceLimit(null);
            }
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    const retryDeviceRegistration = async () => {
        if (session?.access_token) {
            const result = await registerDevice(session.access_token);
            setDeviceLimit(result.ok ? null : (result.devices ?? []));
        }
    };

    return (
        <AuthContext.Provider value={{ session, user, isLoading, signOut, deviceLimit, retryDeviceRegistration }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
