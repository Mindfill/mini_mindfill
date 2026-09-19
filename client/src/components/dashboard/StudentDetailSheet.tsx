import { useQuery } from "@tanstack/react-query";
import TechcessLoader from "@/components/brand/TechcessLoader";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { SchoolStudentDetail, StudentRow } from "@/lib/api";

export const STATUS_STYLES: Record<StudentRow["status"], string> = {
    active: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
    inactive: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    at_risk: "bg-red-500/10 text-red-700 dark:text-red-400",
};

export const STATUS_LABEL: Record<StudentRow["status"], string> = {
    active: "Active",
    inactive: "Inactive",
    at_risk: "At Risk",
};

/** Everything an adult can act on for one student: where they are, how often
 * they study, what they're strong at, and — the useful part — what they
 * actually struggled with, lesson by lesson. Shared by the school and parent
 * dashboards; each passes its own access-checked fetcher. */
export default function StudentDetailSheet({
    studentId,
    accessToken,
    onClose,
    scope,
    fetchDetail,
}: {
    studentId: string | null;
    accessToken: string;
    onClose: () => void;
    /** Keeps the two dashboards' caches apart. */
    scope: "school" | "parent";
    fetchDetail: (studentId: string, accessToken: string) => Promise<SchoolStudentDetail>;
}) {
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: [scope, "student", studentId],
        queryFn: () => fetchDetail(studentId!, accessToken),
        enabled: !!studentId,
        staleTime: 30_000,
        retry: 1,
    });

    return (
        <Sheet open={!!studentId} onOpenChange={(open) => !open && onClose()}>
            <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
                {isPending && studentId ? (
                    <TechcessLoader label="Loading this student" />
                ) : isError || !data ? (
                    <div className="py-16 text-center space-y-4">
                        <p className="text-sm text-muted-foreground">Couldn't load this student.</p>
                        <button onClick={() => refetch()} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                            Try again
                        </button>
                    </div>
                ) : (
                    <>
                        <SheetHeader className="text-left">
                            <SheetTitle className="flex items-center gap-2 flex-wrap">
                                {data.student_name}
                                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[data.status]}`}>
                                    {STATUS_LABEL[data.status]}
                                </span>
                            </SheetTitle>
                            <SheetDescription>
                                {data.class_level || "—"} ·{" "}
                                {data.last_active_date
                                    ? `last active ${new Date(data.last_active_date).toLocaleDateString()}`
                                    : "never active"}
                            </SheetDescription>
                        </SheetHeader>

                        <div className="mt-6 space-y-6">
                            <div className="grid grid-cols-3 gap-3">
                                <Stat label="Sessions" value={String(data.sessions_this_week)} sub="this week" />
                                <Stat label="Streak" value={String(data.streak.current_streak)} sub={`best ${data.streak.longest_streak}`} />
                                <Stat label="Study" value={`${Math.round(data.usage_week.current_sum)}m`} sub="this week" />
                            </div>

                            <section>
                                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Currently</h4>
                                <p className="text-sm">
                                    {data.current_chapter || "Not started"}
                                    {data.current_subsection && <span className="text-muted-foreground"> · {data.current_subsection}</span>}
                                </p>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                                    <div className="h-full bg-primary rounded-full" style={{ width: `${data.current_chapter_progress_percent}%` }} />
                                </div>
                            </section>

                            {data.recent_struggles.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                        What they struggled with
                                    </h4>
                                    <ul className="space-y-3">
                                        {data.recent_struggles.map((s, i) => (
                                            <li key={i} className="rounded-xl bg-muted/40 p-3">
                                                <p className="text-sm font-medium">{s.subsection_title}</p>
                                                <p className="text-xs text-muted-foreground mb-1">
                                                    {s.chapter_title}
                                                    {s.comprehension_depth ? ` · reached ${s.comprehension_depth}` : ""}
                                                </p>
                                                <ul className="list-disc list-inside space-y-0.5">
                                                    {s.struggle_points.map((p, j) => (
                                                        <li key={j} className="text-xs text-foreground/80">{p}</li>
                                                    ))}
                                                </ul>
                                            </li>
                                        ))}
                                    </ul>
                                </section>
                            )}

                            <ChipList title="Strong at" items={data.strengths} tone="text-emerald-700 dark:text-emerald-400" />
                            <ChipList title="Needs work" items={data.weaknesses} tone="text-amber-700 dark:text-amber-400" />
                            <ChipList title="Improved over time" items={data.resolved_weaknesses} tone="text-primary" />

                            {/* Empty for university students — no curriculum chapters. */}
                            {data.chapter_rings.length > 0 && (
                                <section>
                                    <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Chapters</h4>
                                    <div className="space-y-2">
                                        {data.chapter_rings.map((r) => (
                                            <div key={r.chapter_id}>
                                                <div className="flex justify-between text-xs mb-1">
                                                    <span className={r.is_complete ? "" : "text-muted-foreground"}>{r.chapter_title}</span>
                                                    <span className="text-muted-foreground">{Math.round(r.percent_complete)}%</span>
                                                </div>
                                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                    <div
                                                        className={`h-full rounded-full ${r.is_complete ? "bg-emerald-500" : "bg-primary"}`}
                                                        style={{ width: `${r.percent_complete}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
    return (
        <div className="rounded-xl bg-muted/40 p-3 text-center">
            <p className="text-lg font-semibold">{value}</p>
            <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="text-[11px] text-muted-foreground">{sub}</p>
        </div>
    );
}

function ChipList({ title, items, tone }: { title: string; items: string[]; tone: string }) {
    if (items.length === 0) return null;
    return (
        <section>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{title}</h4>
            <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                    <span key={item} className={`text-xs font-medium px-2.5 py-1 rounded-full bg-muted ${tone}`}>
                        {item}
                    </span>
                ))}
            </div>
        </section>
    );
}
