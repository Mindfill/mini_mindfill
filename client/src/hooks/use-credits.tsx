import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";

interface CreditsContextType {
    /** Current balance, or null while unknown / no row. */
    credits: number | null;
    loading: boolean;
    /** True unless we know the balance is depleted (null = unknown → allow). */
    hasCredits: boolean;
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
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!userId) {
            setCredits(null);
            return;
        }
        let cancelled = false;
        setLoading(true);

        // 1. Initial balance.
        supabase
            .from("user_credits")
            .select("balance")
            .single()
            .then(({ data, error }) => {
                if (cancelled) return;
                if (!error && data) setCredits(Number(data.balance));
                setLoading(false);
            });

        // 2. Live updates whenever the backend deducts.
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
                    const balance = (payload.new as { balance?: number | string })?.balance;
                    if (balance !== undefined && balance !== null) setCredits(Number(balance));
                }
            )
            .subscribe();

        return () => {
            cancelled = true;
            supabase.removeChannel(channel);
        };
    }, [userId]);

    const hasCredits = credits === null || credits > 0;

    return (
        <CreditsContext.Provider value={{ credits, loading, hasCredits }}>
            {children}
        </CreditsContext.Provider>
    );
}

export function useCredits(): CreditsContextType {
    const ctx = useContext(CreditsContext);
    if (!ctx) throw new Error("useCredits must be used within a CreditsProvider");
    return ctx;
}
