/**
 * "+35 min", "−12 min", "+1h 20m". Used for this-week-vs-last-week study time
 * on every dashboard — a minutes difference rather than a percentage, which
 * ran past 100% (10 → 45 min read as "+350%") and was meaningless when the
 * previous week was empty.
 */
export function formatMinutesChange(minutes: number): string {
    const m = Math.round(minutes);
    const sign = m > 0 ? "+" : m < 0 ? "−" : "";
    const abs = Math.abs(m);
    if (abs < 60) return `${sign}${abs} min`;
    const h = Math.floor(abs / 60);
    const rest = abs % 60;
    return `${sign}${h}h${rest ? ` ${rest}m` : ""}`;
}
