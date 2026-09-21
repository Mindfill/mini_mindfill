import { useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { ChevronLeft, ChevronRight, Loader2, Moon, Repeat, Users } from "lucide-react";
import { useUsageAnalytics } from "@/lib/appQueries";
import type { UsageAnalytics, UsageScope } from "@/lib/usageAnalytics";

/**
 * Usage analytics, identical on the admin, school and parent dashboards.
 *
 * Read-only throughout: a week chart of when students actually study, three
 * figures underneath it, and the lessons students go back to on their own.
 * Nothing here has an action beyond stepping between weeks.
 *
 * The hour chart runs 0–23 in the student's own clock, so the after-school
 * evening peak lands where a Nigerian reader expects it. Bars that fall
 * outside school hours are tinted differently — that's the same definition the
 * "outside school hours" figure uses, shown rather than just stated.
 */

/** "14" -> "2pm". Short enough for a 24-slot axis on a phone. */
function hourLabel(hour: number): string {
    if (hour === 0) return "12a";
    if (hour === 12) return "12p";
    return hour < 12 ? `${hour}a` : `${hour - 12}p`;
}

/** Matches app/core/usage_analytics.py — weekends are entirely out of hours,
 *  so an hour alone can't decide it. This only tints the chart. */
function isOutOfHoursHour(hour: number, startHour: number, endHour: number): boolean {
    return hour < startHour || hour >= endHour;
}

function formatRange(start: string, end: string): string {
    const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
    return `${new Date(start).toLocaleDateString(undefined, opts)} – ${new Date(end).toLocaleDateString(undefined, opts)}`;
}

export default function UsageAnalyticsPanel({
    scope,
    accessToken,
    enabled = true,
}: {
    scope: UsageScope;
    accessToken: string;
    enabled?: boolean;
}) {
    // 0 = the week in progress; each step back adds one.
    const [weekOffset, setWeekOffset] = useState(0);
    const { data, isPending, isError, isFetching, refetch } = useUsageAnalytics(
        scope,
        weekOffset,
        accessToken,
        enabled && !!accessToken,
    );

    if (isPending && !data) {
        return (
            <section className="glass-panel rounded-2xl p-6 flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </section>
        );
    }

    if (isError && !data) {
        return (
            <section className="glass-panel rounded-2xl p-6 text-center space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    Usage analytics
                </h3>
                <p className="text-sm text-muted-foreground">Couldn't load these figures.</p>
                <button
                    onClick={() => refetch()}
                    className="min-h-[40px] px-5 rounded-xl glass-chip text-sm font-medium"
                >
                    Retry
                </button>
            </section>
        );
    }

    if (!data) return null;

    return (
        <section className="space-y-4">
            <WeekHeader
                data={data}
                busy={isFetching}
                onBack={() => setWeekOffset((w) => w + 1)}
                onForward={() => setWeekOffset((w) => Math.max(w - 1, 0))}
            />

            {data.student_count === 0 ? (
                <NoSecondaryStudents scope={scope} linkedChildren={data.linked_children} />
            ) : (
                <>
                    <HourChart data={data} busy={isFetching} />
                    <Metrics data={data} />
                    <Revisits data={data} />
                </>
            )}
        </section>
    );
}

function WeekHeader({
    data,
    busy,
    onBack,
    onForward,
}: {
    data: UsageAnalytics;
    busy: boolean;
    onBack: () => void;
    onForward: () => void;
}) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    When students study
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                    {data.week.label} · {formatRange(data.week.start, data.week.end)}
                </p>
            </div>
            <div className="flex items-center gap-1">
                {busy && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground mr-1" />}
                <button
                    onClick={onBack}
                    aria-label="Previous week"
                    className="w-9 h-9 rounded-full glass-chip flex items-center justify-center hover:brightness-110"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                    onClick={onForward}
                    disabled={data.week.is_current}
                    aria-label="Next week"
                    className="w-9 h-9 rounded-full glass-chip flex items-center justify-center hover:brightness-110 disabled:opacity-40"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function HourChart({ data, busy }: { data: UsageAnalytics; busy: boolean }) {
    const { start_hour, end_hour } = data.school_hours;
    const chart = data.hours.map((h) => ({
        hour: h.hour,
        label: hourLabel(h.hour),
        sessions: h.sessions,
        outOfHours: isOutOfHoursHour(h.hour, start_hour, end_hour),
    }));

    return (
        <div className="glass-panel rounded-2xl p-6">
            <div className="flex items-baseline justify-between gap-3 mb-4">
                <p className="text-sm">
                    <span className="text-2xl font-bold">{data.total_sessions}</span>{" "}
                    <span className="text-muted-foreground">
                        {data.total_sessions === 1 ? "session" : "sessions"}
                    </span>
                </p>
                <p className="text-[11px] text-muted-foreground">
                    Shaded bars fall outside school hours
                </p>
            </div>
            <div className="relative">
                {busy && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/40 rounded-xl">
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                )}
                <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chart}>
                        <XAxis
                            dataKey="label"
                            axisLine={false}
                            tickLine={false}
                            interval={2}
                            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
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
                            formatter={(value: number) => [
                                `${value} ${value === 1 ? "session" : "sessions"}`,
                                "Started",
                            ]}
                            labelFormatter={(label: string) => `Started around ${label}`}
                        />
                        <Bar dataKey="sessions" radius={[4, 4, 0, 0]}>
                            {chart.map((d) => (
                                <Cell
                                    key={d.hour}
                                    fill="hsl(var(--primary))"
                                    fillOpacity={d.outOfHours ? 0.4 : 0.9}
                                />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

function Metrics({ data }: { data: UsageAnalytics }) {
    const { start_hour, end_hour } = data.school_hours;
    const to12 = (h: number) => {
        if (h === 0) return "12am";
        if (h === 12) return "12pm";
        return h > 12 ? `${h - 12}pm` : `${h}am`;
    };

    return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Metric
                icon={<Users className="w-4 h-4" />}
                value={data.avg_sessions_per_student.toFixed(1)}
                label="Avg sessions per student"
                hint={`Across ${data.student_count} ${data.student_count === 1 ? "student" : "students"} this week`}
            />
            <Metric
                icon={<Moon className="w-4 h-4" />}
                value={`${data.outside_school_hours.percent.toFixed(0)}%`}
                label="Started outside school hours"
                hint={`Before ${to12(start_hour)} or after ${to12(end_hour)} on weekdays, and all weekend`}
            />
            <Metric
                icon={<Repeat className="w-4 h-4" />}
                value={String(data.revisit_subsection_count)}
                label="Lessons being revisited"
                hint="Opened again by students who'd already finished them"
            />
        </div>
    );
}

function Metric({
    icon,
    value,
    label,
    hint,
}: {
    icon: React.ReactNode;
    value: string;
    label: string;
    hint: string;
}) {
    return (
        <div className="glass-panel rounded-2xl p-5">
            <div className="flex items-center gap-2 text-primary mb-2">{icon}</div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-sm font-medium mt-0.5">{label}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{hint}</p>
        </div>
    );
}

function Revisits({ data }: { data: UsageAnalytics }) {
    return (
        <div className="glass-panel rounded-2xl p-6">
            <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Going back on their own
            </h4>
            <p className="text-xs text-muted-foreground mb-4">
                Lessons reopened this week by students who had already completed them. Nothing prompts these.
                {data.revisit_subsection_count > data.revisits.length &&
                    ` Showing the top ${data.revisits.length} of ${data.revisit_subsection_count}.`}
            </p>
            {data.revisits.length === 0 ? (
                <p className="text-sm text-muted-foreground">No voluntary revisits this week.</p>
            ) : (
                <ul className="space-y-2">
                    {data.revisits.map((r) => (
                        <li
                            key={r.subsection_id}
                            className="flex items-start justify-between gap-4 text-sm border-b border-border/30 last:border-0 pb-2 last:pb-0"
                        >
                            <span className="min-w-0">
                                <span className="block font-medium truncate">{r.subsection_title || "Untitled lesson"}</span>
                                {r.chapter_title && (
                                    <span className="block text-xs text-muted-foreground truncate">{r.chapter_title}</span>
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0 pt-0.5">
                                {r.sessions}× · {r.students} {r.students === 1 ? "student" : "students"}
                            </span>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}

/** Nothing to chart — and the reason matters, so say which one it is. */
function NoSecondaryStudents({
    scope,
    linkedChildren,
}: {
    scope: UsageScope;
    linkedChildren?: number;
}) {
    const universityOnly = scope === "parent" && (linkedChildren ?? 0) > 0;
    return (
        <div className="glass-panel rounded-2xl p-6">
            <p className="text-sm text-muted-foreground">
                {universityOnly
                    ? "These figures aren't available for university accounts yet — they're built from secondary lesson sessions, which the university side doesn't record."
                    : scope === "parent"
                      ? "No linked children yet."
                      : "No secondary students in this view yet."}
            </p>
        </div>
    );
}
