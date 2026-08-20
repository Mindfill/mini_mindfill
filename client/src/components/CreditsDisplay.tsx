import { useCredits } from "@/hooks/use-credits";
import { Coins } from "lucide-react";

const MAX_CREDITS = 10; // progress-bar scale

/** Persistent credit balance for the sidebar: "Credits X.XX" + a 0–10 bar. */
export function CreditsDisplay() {
    const { credits, loading, isPaid } = useCredits();

    // Paid users don't spend credits — hide the bar entirely.
    if (isPaid) return null;

    // No row / not loaded yet and nothing in flight — render nothing.
    if (credits === null && !loading) return null;

    const value = credits ?? 0;
    const pct = Math.max(0, Math.min(100, (value / MAX_CREDITS) * 100));
    const low = credits !== null && value <= 2;

    return (
        <div className="px-4 py-3 rounded-xl border border-border bg-card/50">
            <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Coins className="w-3.5 h-3.5" /> Credits
                </span>
                <span className={`text-xs font-bold ${low ? "text-red-400" : "text-foreground"}`}>
                    {credits === null ? "…" : value.toFixed(2)}
                </span>
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${low ? "bg-red-400" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
        </div>
    );
}
