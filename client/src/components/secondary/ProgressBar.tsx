export function ProgressBar({ value, complete, label }: { value: number; complete?: boolean; label?: string }) {
    const pct = Math.max(0, Math.min(100, value));
    return (
        <div className="space-y-1.5">
            <div
                className="h-1.5 w-full bg-muted rounded-full overflow-hidden"
                role="progressbar"
                aria-valuenow={Math.round(pct)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={label}
            >
                <div
                    className={`h-full rounded-full transition-all duration-700 ${complete ? "bg-emerald-500" : "bg-primary"}`}
                    style={{ width: `${pct}%` }}
                />
            </div>
            {label && <p className="text-xs text-muted-foreground">{label}</p>}
        </div>
    );
}
