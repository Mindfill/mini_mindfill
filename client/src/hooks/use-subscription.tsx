import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchSubscription, type PaymentPlan } from "@/lib/api";

interface SubscriptionContextType {
    /** subscriptions.status: "active" | "cancelled" | "lapsed" | "free" (null while unknown). */
    status: string | null;
    plan: PaymentPlan | null;
    /** ISO datetime the current paid period ends, or null. */
    currentPeriodEnd: string | null;
    loading: boolean;
    /** Re-fetch the billing record (e.g. after a cancel or returning from checkout). */
    refresh: () => void;

    // ── Global paywall prompt ────────────────────────────────────────────
    paywallOpen: boolean;
    /** Open the paywall dialog (call this on a 402 / out-of-credits). */
    promptUpgrade: () => void;
    closeUpgrade: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Loads the signed-in user's subscription billing record from GET /subscriptions
 * (plan, status, renewal date) and owns the shared paywall-dialog state.
 *
 * NOTE: the *access* truth (whether the user is on a paid plan) lives in
 * `useCredits().isPaid`, sourced live from user_credits.subscription_status.
 * This hook is for billing *details* shown on the profile/upgrade pages.
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const accessToken = session?.access_token;

    const [status, setStatus] = useState<string | null>(null);
    const [plan, setPlan] = useState<PaymentPlan | null>(null);
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
            setPlan(null);
            setCurrentPeriodEnd(null);
            return;
        }
        let cancelled = false;
        setLoading(true);
        fetchSubscription(accessToken)
            .then((sub) => {
                if (cancelled) return;
                setStatus(sub.subscription_status ?? "free");
                setPlan(sub.plan_type ?? null);
                setCurrentPeriodEnd(sub.current_period_end ?? null);
            })
            .catch((err) => {
                // Non-fatal: leave details unknown rather than blocking the app.
                console.warn("Could not load subscription record:", err);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [accessToken, nonce]);

    return (
        <SubscriptionContext.Provider
            value={{
                status,
                plan,
                currentPeriodEnd,
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
