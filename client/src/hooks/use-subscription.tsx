import { createContext, useContext, useState, useCallback, ReactNode } from "react";

interface SubscriptionContextType {
    /** Whether the upgrade/paywall dialog is open. */
    paywallOpen: boolean;
    /** Open the paywall dialog (call this on a 402 / out-of-credits). */
    promptUpgrade: () => void;
    /** Close the paywall dialog. */
    closeUpgrade: () => void;
}

const SubscriptionContext = createContext<SubscriptionContextType | undefined>(undefined);

/**
 * Owns the shared paywall-dialog state.
 *
 * NOTE: the *access* truth (whether the user is on a paid plan) lives in
 * `useCredits().isPaid`, sourced live from user_credits.subscription_status.
 * The backend exposes no GET endpoint for richer billing details (plan,
 * renewal date), so we don't fetch any here.
 */
export function SubscriptionProvider({ children }: { children: ReactNode }) {
    const [paywallOpen, setPaywallOpen] = useState(false);

    const promptUpgrade = useCallback(() => setPaywallOpen(true), []);
    const closeUpgrade = useCallback(() => setPaywallOpen(false), []);

    return (
        <SubscriptionContext.Provider value={{ paywallOpen, promptUpgrade, closeUpgrade }}>
            {children}
        </SubscriptionContext.Provider>
    );
}

export function useSubscription(): SubscriptionContextType {
    const ctx = useContext(SubscriptionContext);
    if (!ctx) throw new Error("useSubscription must be used within a SubscriptionProvider");
    return ctx;
}
