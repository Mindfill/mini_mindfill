import { BarChart, Bar, XAxis, ResponsiveContainer, Tooltip, Cell } from "recharts";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import type { UsageDay, UsagePeriod } from "@/lib/api";
import { formatMinutesChange } from "@/lib/studyTime";

interface UsageGraphCardProps {
    usage: { days: UsageDay[]; change_minutes?: number; change_direction: string };
    title?: string;
    /** Omit to render without a toggle (uni/parent dashboards — 7-day only). */
    period?: UsagePeriod;
    onPeriodChange?: (period: UsagePeriod) => void;
    loading?: boolean;
}

export default function UsageGraphCard({
    usage,
    title = "This Week",
    period,
    onPeriodChange,
    loading = false,
}: UsageGraphCardProps) {
    const isWeekly = period === "weekly";

    const data = usage.days.map((d) => ({
        // Weekly buckets are labelled by the week's first day ("2 Sep"), daily
        // ones by weekday — the backend sends a plain date either way.
        day: isWeekly
            ? new Date(d.date).toLocaleDateString(undefined, { day: "numeric", month: "short" })
            : new Date(d.date).toLocaleDateString(undefined, { weekday: "short" }),
        minutes: d.minutes,
    }));

    const isUp = usage.change_direction === "up";
    const comparisonLabel = isWeekly ? "vs previous 4 weeks" : "vs last week";

    return (
        <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    {isWeekly ? "Last 4 Weeks" : title}
                </h3>
                <div className="flex items-center gap-3">
                    {usage.change_direction !== "same" && (
                        <div className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}>
                            {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                            {formatMinutesChange(usage.change_minutes ?? 0)} {comparisonLabel}
                        </div>
                    )}
                    {period && onPeriodChange && (
                        <div className="flex items-center rounded-full bg-muted/60 p-0.5" role="group" aria-label="Graph period">
                            {(["daily", "weekly"] as const).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => onPeriodChange(p)}
                                    aria-pressed={period === p}
                                    className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                                        period === p
                                            ? "bg-background text-foreground shadow-sm"
                                            : "text-muted-foreground hover:text-foreground"
                                    }`}
                                    data-testid={`usage-period-${p}`}
                                >
                                    {p === "daily" ? "Daily" : "Weekly"}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
            <div className="relative">
                {loading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 rounded-xl">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                )}
                <ResponsiveContainer width="100%" height={140}>
                    <BarChart data={data}>
                        <XAxis
                            dataKey="day"
                            axisLine={false}
                            tickLine={false}
                            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                        />
                        <Tooltip
                            cursor={{ fill: "hsl(var(--primary) / 0.08)" }}
                            contentStyle={{
                                background: "hsl(var(--card))",
                                border: "1px solid hsl(var(--border))",
                                borderRadius: 8,
                                fontSize: 12,
                            }}
                            itemStyle={{ color: "hsl(var(--foreground))" }}
                            labelStyle={{ color: "hsl(var(--foreground))" }}
                            formatter={(value: number) => [`${value} min`, "Active time"]}
                            labelFormatter={(label: string) => (isWeekly ? `Week of ${label}` : label)}
                        />
                        <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>
                            {data.map((_, i) => (
                                <Cell key={i} fill="hsl(var(--primary))" fillOpacity={0.85} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
