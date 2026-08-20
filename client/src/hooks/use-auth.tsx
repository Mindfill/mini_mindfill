import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { Session, User } from "@supabase/supabase-js";

interface AuthContextType {
    session: Session | null;
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [session, setSession] = useState<Session | null>(null);
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

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
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
            if (!mounted) return;
            setSession((prev) =>
                prev?.access_token === newSession?.access_token ? prev : newSession
            );
            setUser((prev) =>
                prev?.id === newSession?.user?.id ? prev : newSession?.user ?? null
            );
            setIsLoading(false);
        });

        return () => {
            mounted = false;
            subscription.unsubscribe();
        };
    }, []);

    const signOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <AuthContext.Provider value={{ session, user, isLoading, signOut }}>
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
