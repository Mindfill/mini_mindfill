import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchProfile } from "@/lib/api";

interface SubscriptionContextType {
    /** Raw billing state: "free" | "active" | … (null while unknown). */
    status: string | null;
    /** ISO datetime the current paid period ends, or null. */
    currentPeriodEnd: string | null;
    /** True only when we positively know the plan is paid ("active"). */
    isPaid: boolean;
    loading: boolean;
    /** Re-fetch billing state (e.g. after a cancel or returning from checkout). */
    refresh: () => void;

    // ── Global paywall prompt ────────────────────────────────────────────
    /** Whether the upgrade/paywall dialog is open. */
    paywallOpen: boolean;
    /** Open the paywall dialog (call this on a 402 / out-of-credits). */
    promptUpgrade: () => void;
    /** Close the paywall dialog. */
    closeUpgrade: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

const PAID_STATUS = "active";

/**
 * Loads the signed-in user's subscription state from GET /profile and exposes
 * it app-wide, plus the shared paywall-dialog open state.
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const accessToken = session?.access_token;

    const [status, setStatus] = useState<string | null>(null);
    const [currentPeriodEnd, setCurrentPeriodEnd] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [paywallOpen, setPaywallOpen] = useState(false);
    const [nonce, setNonce] = useState(0);

    const refresh = useCallback(() => setNonce((n) => n + 1), []);
    const promptUpgrade = useCallback(() => setPaywallOpen(true), []);
    const closeUpgrade = useCallback(() => setPaywallOpen(false), []);

    useEffect(() => {
        if (!accessToken) {
            setStatus(null);
            setCurrentPeriodEnd(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchProfile(accessToken)
            .then((p) => {
                if (cancelled) return;
                setStatus(p.subscription_status ?? "free");
                setCurrentPeriodEnd(p.current_period_end ?? null);
            })
            .catch((err) => {
                // Non-fatal: leave state unknown rather than blocking the app.
                console.warn("Could not load subscription status:", err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [accessToken, nonce]);

    const isPaid = status === PAID_STATUS;

    return (
        <SubscriptionContext.Provider
            value={{
                status,
                currentPeriodEnd,
                isPaid,
                loading,
                refresh,
                paywallOpen,
                promptUpgrade,
                closeUpgrade,
            }}
        >
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription(): SubscriptionContextType {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
    return ctx;
}
