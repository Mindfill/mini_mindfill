import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import { Users, Flame, Clock, GraduationCap, AlertTriangle, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import TechcessLoader from "@/components/brand/TechcessLoader";
import PageFade from "@/components/ui/page-fade";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
    fetchSchoolMonthlyReport,
    fetchSchoolStudentDetail,
    SchoolDashboardResponse,
    StudentRow,
} from "@/lib/api";
import { useSchoolDashboard } from "@/lib/appQueries";

const STATUS_STYLES: Record<StudentRow["status"], string> = {
    active: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    inactive: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    at_risk: "bg-red-500/10 text-red-600 dark:text-red-400",
};

const STATUS_LABEL: Record<StudentRow["status"], string> = {
    active: "Active",
    inactive: "Inactive",
    at_risk: "At Risk",
};

/** Quote every field — student names and chapter titles can contain commas. */
function toCsvRow(values: (string | number)[]): string {
    return values.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",");
}

function buildReportCsv(report: SchoolDashboardResponse): string {
    const { overview } = report;
    return [
        toCsvRow(["School", report.school_name]),
        toCsvRow(["Generated", report.generated_at]),
        "",
        toCsvRow(["Total students", overview.total_students]),
        toCsvRow(["Active this week", overview.active_this_week]),
        toCsvRow(["Avg minutes this week", overview.avg_study_minutes_this_week]),
        toCsvRow(["Avg streak", overview.avg_streak]),
        toCsvRow(["% completed 1+ chapter", overview.chapters_completed_percent]),
        "",
        toCsvRow(["Weak topic", "Struggle count"]),
        ...report.weak_topics.map((t) => toCsvRow([t.chapter_title, t.struggle_count])),
        "",
        toCsvRow([
            "Name", "Class", "Sessions this week", "Current chapter",
            "Strengths", "Improving", "Last active", "Status",
        ]),
        ...report.students.map((s) =>
            toCsvRow([
                s.student_name,
                s.class_level,
                s.sessions_this_week,
                s.current_chapter,
                s.top_strengths.join("; "),
                s.resolved_weaknesses.join("; "),
                s.last_active_date || "never",
                STATUS_LABEL[s.status],
            ])
        ),
    ].join("\n");
}

export default function SchoolDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const [downloadingReport, setDownloadingReport] = useState(false);
    const [openStudentId, setOpenStudentId] = useState<string | null>(null);
    const { toast } = useToast();

    const userName = user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    const firstName = userName.split(" ")[0];

    // Cached like every other section (lib/appQueries.ts). School admins are
    // provisioned manually and exempt from the onboarding gate, so this only
    // waits on the session.
    const { data, isPending, isError, refetch } = useSchoolDashboard(session?.access_token ?? "", !!session);
    const loading = isPending && !data;
    const error = isError && !data ? "Unable to load dashboard" : null;
    const loadDashboard = () => refetch();

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [session, authLoading, navigate]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    // Fetches the same snapshot the monthly email carries and saves it as CSV,
    // so a school can open it in Excel rather than only reading it in-app.
    const handleDownloadReport = async () => {
        if (!session) return;
        setDownloadingReport(true);
        try {
            const report = await fetchSchoolMonthlyReport(session.access_token);
            const blob = new Blob([buildReportCsv(report)], { type: "text/csv;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            const stamp = report.generated_at.slice(0, 10);
            link.download = `${(report.school_name || "school").replace(/[^\w-]+/g, "-")}-report-${stamp}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (err) {
            console.error(err);
            toast({
                title: "Report unavailable",
                description: "We couldn't generate the monthly report. Please try again.",
                variant: "destructive",
            });
        } finally {
            setDownloadingReport(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar variant="school_admin" userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 overflow-y-auto relative">
                    <TechcessLoader />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar variant="school_admin" userName={userName} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 flex items-center justify-center p-8 relative">
                    <div className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center">
                        <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
                        <p className="text-muted-foreground text-sm mb-6">There was a problem fetching your data.</p>
                        <button
                            onClick={() => loadDashboard()}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { school_name, overview, students, weak_topics } = data;

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar variant="school_admin" userName={userName} activeItem="home" onSignOut={handleSignOut} />

            <div className="flex-1 overflow-y-auto relative">
                <PageFade>
                <main className="max-w-6xl mx-auto p-6 md:p-10 space-y-8">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                        <WelcomeHeader name={firstName} subtitle={school_name || "No school linked to this account yet."} />
                        <button
                            onClick={handleDownloadReport}
                            disabled={downloadingReport}
                            className="glass-chip flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-foreground hover:brightness-110 transition disabled:opacity-60"
                            data-testid="button-monthly-report"
                        >
                            {downloadingReport ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Download className="w-4 h-4" />
                            )}
                            Monthly report
                        </button>
                    </div>

                    {/* Overview stats */}
                    <section className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <Users className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">{overview.total_students}</p>
                            <p className="text-xs text-muted-foreground">Students</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">{overview.active_this_week}</p>
                            <p className="text-xs text-muted-foreground">Active This Week</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <Clock className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">{Math.round(overview.avg_study_minutes_this_week)}</p>
                            <p className="text-xs text-muted-foreground">Avg Min/Week</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <Flame className="w-5 h-5 text-orange-500 mx-auto mb-2" />
                            <p className="text-2xl font-bold">{overview.avg_streak.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Avg Streak</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <GraduationCap className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">{Math.round(overview.chapters_completed_percent)}%</p>
                            <p className="text-xs text-muted-foreground">1+ Chapter Done</p>
                        </div>
                    </section>

                    {/* Weak topics */}
                    {weak_topics.length > 0 && (
                        <section className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-500" /> Weak Topics School-Wide
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {weak_topics.map((topic) => (
                                    <span key={topic.chapter_title} className="text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1.5 rounded-full">
                                        {topic.chapter_title} <span className="opacity-60">({topic.struggle_count})</span>
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Student table */}
                    <section className="glass-panel rounded-2xl overflow-hidden pb-2">
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider p-6 pb-4">Students</h3>
                        {students.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                                            <th className="px-6 py-2 font-medium">Name</th>
                                            <th className="px-6 py-2 font-medium">Class</th>
                                            <th className="px-6 py-2 font-medium">Sessions</th>
                                            <th className="px-6 py-2 font-medium">Current Chapter</th>
                                            <th className="px-6 py-2 font-medium">Highlights</th>
                                            <th className="px-6 py-2 font-medium">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map((s) => (
                                            <tr
                                                key={s.student_id}
                                                onClick={() => setOpenStudentId(s.student_id)}
                                                tabIndex={0}
                                                role="button"
                                                aria-label={`View ${s.student_name}'s details`}
                                                onKeyDown={(e) => {
                                                    if (e.key === "Enter" || e.key === " ") {
                                                        e.preventDefault();
                                                        setOpenStudentId(s.student_id);
                                                    }
                                                }}
                                                className="border-b border-border/30 last:border-0 cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none transition-colors"
                                            >
                                                <td className="px-6 py-3 font-medium">{s.student_name}</td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.class_level}</td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.sessions_this_week}</td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.current_chapter}</td>
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col gap-1 max-w-[220px]">
                                                        {s.top_strengths.length > 0 && (
                                                            <span className="text-xs text-emerald-600 dark:text-emerald-400 truncate">
                                                                Strong: {s.top_strengths.join(", ")}
                                                            </span>
                                                        )}
                                                        {s.resolved_weaknesses.length > 0 && (
                                                            <span className="text-xs text-primary truncate">
                                                                Improving: {s.resolved_weaknesses.join(", ")}
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td className="px-6 py-3">
                                                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_STYLES[s.status]}`}>
                                                        {STATUS_LABEL[s.status]}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm px-6 pb-6">No students enrolled yet.</p>
                        )}
                    </section>
                </main>
                </PageFade>
            </div>

            <StudentDetailSheet
                studentId={openStudentId}
                accessToken={session?.access_token ?? ""}
                onClose={() => setOpenStudentId(null)}
            />
        </div>
    );
}

/** Everything the school can act on for one student: where they are, how
 * often they study, what they're strong at, and — the useful part — what they
 * actually struggled with, lesson by lesson. */
function StudentDetailSheet({
    studentId,
    accessToken,
    onClose,
}: {
    studentId: string | null;
    accessToken: string;
    onClose: () => void;
}) {
    const { data, isPending, isError, refetch } = useQuery({
        queryKey: ["school", "student", studentId],
        queryFn: () => fetchSchoolStudentDetail(studentId!, accessToken),
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

                            <ChipList title="Strong at" items={data.strengths} tone="text-emerald-600 dark:text-emerald-400" />
                            <ChipList title="Needs work" items={data.weaknesses} tone="text-amber-600 dark:text-amber-400" />
                            <ChipList title="Improved over time" items={data.resolved_weaknesses} tone="text-primary" />

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
