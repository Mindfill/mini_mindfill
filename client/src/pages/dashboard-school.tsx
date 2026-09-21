import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import { Users, Flame, Clock, GraduationCap, AlertTriangle, Download, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import TechcessLoader from "@/components/brand/TechcessLoader";
import PageFade from "@/components/ui/page-fade";
import StudentDetailSheet, { STATUS_LABEL, STATUS_STYLES } from "@/components/dashboard/StudentDetailSheet";
import UsageAnalyticsPanel from "@/components/dashboard/UsageAnalyticsPanel";
import HighlyEngagedBadge from "@/components/dashboard/HighlyEngagedBadge";
import { fetchSchoolMonthlyReport, fetchSchoolStudentDetail } from "@/lib/api";
import { useSchoolDashboard, useUsageAnalytics } from "@/lib/appQueries";

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
    // Read separately so the usage panel can fail or lag without holding up the
    // rest of the dashboard. Current week only — the badge is a "this week"
    // claim, whatever week the panel below is showing.
    const { data: usageThisWeek } = useUsageAnalytics("school", 0, session?.access_token ?? "", !!session);
    const engagedIds = new Set(usageThisWeek?.highly_engaged_student_ids ?? []);
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

    // Fetches the same snapshot the monthly email carries and saves it as a
    // designed A4 PDF, so a school can circulate or print it. jsPDF is pulled
    // in on click rather than imported at the top — it's a large dependency
    // and no other page needs it, so it stays out of the initial bundle.
    const handleDownloadReport = async () => {
        if (!session) return;
        setDownloadingReport(true);
        try {
            const [report, { buildSchoolReportPdf, schoolReportFilename }] = await Promise.all([
                fetchSchoolMonthlyReport(session.access_token),
                import("@/lib/schoolReportPdf"),
            ]);
            buildSchoolReportPdf(report).save(schoolReportFilename(report));
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
                <div className="flex-1 min-w-0 overflow-y-auto relative">
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

            <div className="flex-1 min-w-0 overflow-y-auto relative">
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
                            <Flame className="w-5 h-5 text-orange-700 dark:text-orange-400 mx-auto mb-2" />
                            <p className="text-2xl font-bold">{overview.avg_streak.toFixed(1)}</p>
                            <p className="text-xs text-muted-foreground">Avg Streak</p>
                        </div>
                        <div className="glass-panel rounded-2xl p-4 text-center">
                            <GraduationCap className="w-5 h-5 text-primary mx-auto mb-2" />
                            <p className="text-2xl font-bold">{Math.round(overview.chapters_completed_percent)}%</p>
                            <p className="text-xs text-muted-foreground">1+ Chapter Done</p>
                        </div>
                    </section>

                    {/* Usage analytics — read-only, its own week navigation */}
                    <UsageAnalyticsPanel scope="school" accessToken={session?.access_token ?? ""} enabled={!!session} />

                    {/* Weak topics */}
                    {weak_topics.length > 0 && (
                        <section className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 text-amber-700 dark:text-amber-400" /> Weak Topics School-Wide
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {weak_topics.map((topic) => (
                                    <span key={topic.chapter_title} className="text-sm bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 rounded-full">
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
                                                <td className="px-6 py-3 font-medium">
                                                    <span className="inline-flex items-center gap-2 flex-wrap">
                                                        {s.student_name}
                                                        {engagedIds.has(s.student_id) && <HighlyEngagedBadge />}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.class_level}</td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.sessions_this_week}</td>
                                                <td className="px-6 py-3 text-muted-foreground">{s.current_chapter}</td>
                                                <td className="px-6 py-3">
                                                    <div className="flex flex-col gap-1 max-w-[220px]">
                                                        {s.top_strengths.length > 0 && (
                                                            <span className="text-xs text-emerald-700 dark:text-emerald-400 truncate">
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
                scope="school"
                fetchDetail={fetchSchoolStudentDetail}
            />
        </div>
    );
}
