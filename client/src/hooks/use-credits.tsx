import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

interface CreditsContextType {
    /** Current balance, or null while unknown / no row. */
    credits: number | null;
    loading: boolean;
    /** True unless we know the balance is depleted (null = unknown → allow). */
    hasCredits: boolean;
    /** user_credits.subscription_status: "paid" | "free" | null (unknown). */
    subscriptionStatus: string | null;
    /** Access truth: the user is on a paid plan (subscription_status === "paid"). */
    isPaid: boolean;
}

const CreditsContext = createContext<CreditsContextType | undefined>(undefined);

/**
 * Loads the signed-in user's credit balance and keeps it live via Supabase
 * Realtime (RLS already scopes reads to the user's own row).
 */
export function CreditsProvider({ children }: { children: ReactNode }) {
    const { session } = useAuth();
    const userId = session?.user?.id;
    const [credits, setCredits] = useState<number | null>(null);
    const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId) {
            setCredits(null);
            setSubscriptionStatus(null);
            return;
        }
        let cancelled = false;
        setLoading(true);

        // 1. Initial balance + plan.
        supabase
            .from("user_credits")
            .select("balance, subscription_status")
            .single()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (!error && data) {
                    setCredits(Number(data.balance));
                    setSubscriptionStatus((data.subscription_status as string) ?? null);
                }
                setLoading(false);
            });

        // 2. Live updates whenever the backend deducts or a webhook flips the plan.
        const channel = supabase
            .channel(`user_credits:${userId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "user_credits",
                    filter: `user_id=eq.${userId}`,
                },
                (payload) => {
                    const row = payload.new as { balance?: number | string; subscription_status?: string };
                    if (row?.balance !== undefined && row.balance !== null) setCredits(Number(row.balance));
                    if (row?.subscription_status !== undefined) setSubscriptionStatus(row.subscription_status ?? null);
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const isPaid = subscriptionStatus === "paid";
    // Paid users never spend credits, so treat them as always having credits.
    const hasCredits = isPaid || credits === null || credits > 0;

    return (
        <CreditsContext.Provider value={{ credits, loading, hasCredits, subscriptionStatus, isPaid }}>
            {children}
        </CreditsContext.Provider>
    );
}

export function useCredits(): CreditsContextType {
    const ctx = useContext(CreditsContext);
    if (!ctx) throw new Error("useCredits must be used within a CreditsProvider");
    return ctx;
}
