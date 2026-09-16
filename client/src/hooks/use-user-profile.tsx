import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { fetchOnboardingStatus, OnboardingStatus, UserType, UserRole } from "@/lib/api";

interface UserProfileContextType {
    userType: UserType | null;
    role: UserRole | null;
    onboardingStep: number;
    onboardingCompleted: boolean;
    termsAccepted: boolean;
    fullName: string | null;
    loading: boolean;
    /** Re-fetch after a screen save so the flow controller sees fresh state. */
    refresh: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

// Routes that must stay reachable regardless of onboarding/terms state —
// otherwise a user could never reach /onboarding to finish it. /school is
// staff-only: school_admin accounts are provisioned manually and never go
// through onboarding at all (mirrors app/core/onboarding_gate.py's exemption).
const EXEMPT_PATHS = ["/", "/login", "/reset-password", "/onboarding", "/privacy", "/terms", "/waitlist", "/school", "/admin"];

function isExempt(path: string): boolean {
    return EXEMPT_PATHS.some((p) => path === p || (p !== "/" && path.startsWith(p + "/")));
}

/**
 * Loads onboarding_completed/terms_accepted/user_type from the backend and
 * redirects an incomplete user to /onboarding from anywhere else in the app.
 * This mirrors (client-side, for UX) the server-side 403 enforced by
 * app/core/onboarding_gate.py — that middleware is the real gate.
 */
export function UserProfileProvider({ children }: { children: ReactNode }) {
    const { session, isLoading: authLoading } = useAuth();
    const accessToken = session?.access_token;
    const userId = session?.user?.id;
    const [status, setStatus] = useState<OnboardingStatus | null>(null);
    const [loading, setLoading] = useState(false);
    const [location, navigate] = useLocation();
    // Whose profile `status` currently holds. Supabase rotates the access
    // token hourly (and on tab focus after sleep); that must refresh the
    // profile quietly. Flipping `loading` on every token change made every
    // guarded page swap itself for a loading state — unmounting an open
    // lesson and its chat mid-conversation.
    const loadedFor = useRef<string | null>(null);
    const [failedFor, setFailedFor] = useState<string | null>(null);
    // Between sign-in and the fetch effect starting there's a render where
    // loading=false but status=null — consumers read that as "not a secondary
    // user" and briefly rendered the wrong dashboard. Treat it as loading
    // unless the fetch already failed for this user.
    const effectiveLoading = loading || (!!accessToken && !authLoading && status === null && failedFor !== (userId ?? null));

    const refresh = async () => {
        if (!accessToken) return;
        try {
            const res = await fetchOnboardingStatus(accessToken);
            setStatus(res);
        } catch (e) {
            console.error("Failed to fetch onboarding status", e);
        }
    };

    useEffect(() => {
        if (authLoading) return;
        if (!accessToken) {
            setStatus(null);
            loadedFor.current = null;
            return;
        }
        let cancelled = false;
        const firstLoadForUser = loadedFor.current !== userId;
        if (firstLoadForUser) {
            setStatus(null);
            setLoading(true);
        }
        // One retry: right after login the first request can 401 while the
        // backend's clock catches up with Supabase's. Without it userType
        // stays null for the whole session (secondary pages hang on their
        // skeleton and the device never registers).
        fetchOnboardingStatus(accessToken)
            .catch(async () => {
                await new Promise((resolve) => setTimeout(resolve, 1500));
                if (cancelled) throw new Error("cancelled");
                return fetchOnboardingStatus(accessToken);
            })
            .then((res) => {
                if (cancelled) return;
                setStatus(res);
                loadedFor.current = userId ?? null;
            })
            .catch((e) => {
                if (cancelled) return;
                console.error("Failed to fetch onboarding status", e);
                setFailedFor(userId ?? null);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [accessToken, userId, authLoading]);

    useEffect(() => {
        if (authLoading || loading || !status || !accessToken) return;
        const needsOnboarding = !status.onboarding_completed || !status.terms_accepted;
        if (needsOnboarding && !isExempt(location)) {
            navigate("/onboarding");
        }
    }, [status, authLoading, loading, accessToken, location, navigate]);

    return (
        <UserProfileContext.Provider
            value={{
                userType: status?.user_type ?? null,
                role: status?.role ?? null,
                onboardingStep: status?.onboarding_step ?? 0,
                onboardingCompleted: status?.onboarding_completed ?? false,
                termsAccepted: status?.terms_accepted ?? false,
                fullName: status?.full_name ?? null,
                loading: effectiveLoading,
                refresh,
            }}
        >
            {children}
        </UserProfileContext.Provider>
    );
}

export function useUserProfile(): UserProfileContextType {
    const ctx = useContext(UserProfileContext);
    if (!ctx) throw new Error("useUserProfile must be used within a UserProfileProvider");
    return ctx;
}
