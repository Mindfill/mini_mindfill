import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import TechcessLoader from "@/components/brand/TechcessLoader";
import PageFade from "@/components/ui/page-fade";
import { Flame, TrendingUp, TrendingDown, Users, Sparkles, ArrowUpCircle, ChevronRight } from "lucide-react";
import StudentDetailSheet from "@/components/dashboard/StudentDetailSheet";
import UsageAnalyticsPanel from "@/components/dashboard/UsageAnalyticsPanel";
import { fetchParentStudentDetail, StudentSummary } from "@/lib/api";
import { useParentDashboard } from "@/lib/appQueries";
import { formatMinutesChange } from "@/lib/studyTime";

function StudentCard({ student, onOpen }: { student: StudentSummary; onOpen: () => void }) {
    const change = student.study_minutes_change ?? 0;
    const isUp = change > 0;
    return (
        <div
            onClick={onOpen}
            role="button"
            tabIndex={0}
            aria-label={`View ${student.student_name}'s details`}
            onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpen();
                }
            }}
            className="glass-panel rounded-2xl p-6 space-y-4 text-left cursor-pointer hover:brightness-110 focus-visible:ring-2 focus-visible:ring-primary outline-none transition"
        >
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{student.student_name}</h3>
                    <p className="text-muted-foreground text-xs">{student.class_level}</p>
                </div>
                <div className="flex items-center gap-1.5 text-orange-700 dark:text-orange-400">
                    <Flame className="w-5 h-5 fill-orange-500/20" />
                    <span className="font-bold">{student.current_streak}</span>
                </div>
            </div>

            <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Currently On</p>
                <p className="text-sm font-medium">{student.current_chapter}</p>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mt-2">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-700"
                        style={{ width: `${student.chapter_progress_percent}%` }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{student.study_minutes_this_week} min this week</span>
                {change !== 0 && (
                    <span
                        className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-700 dark:text-emerald-400" : "text-muted-foreground"}`}
                        title="Compared with last week"
                    >
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {formatMinutesChange(change)} vs last week
                    </span>
                )}
            </div>

            {student.top_strengths.length > 0 && (
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Strong in
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {student.top_strengths.map((s) => (
                            <span key={s} className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded-full">
                                {s}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {student.top_weaknesses.length > 0 && (
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5">Could use support with</p>
                    <div className="flex flex-wrap gap-1.5">
                        {student.top_weaknesses.map((w) => (
                            <span key={w} className="text-xs bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2 py-1 rounded-full">
                                {w}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {student.resolved_weaknesses.length > 0 && (
                <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <ArrowUpCircle className="w-3 h-3" /> Improving in
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                        {student.resolved_weaknesses.map((r) => (
                            <span key={r} className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                                {r}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            <p className="flex items-center gap-1 text-xs font-medium text-primary pt-1">
                See full progress <ChevronRight className="w-3.5 h-3.5" />
            </p>
        </div>
    );
}

export default function ParentDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const { onboardingCompleted, fullName, loading: profileLoading } = useUserProfile();
    const [, navigate] = useLocation();
    const [openStudentId, setOpenStudentId] = useState<string | null>(null);
    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    const firstName = userName.split(" ")[0];

    // Cached like every other section (lib/appQueries.ts) — returning shows
    // the last dashboard instantly and refreshes behind it.
    const { data, isPending, isError, refetch } = useParentDashboard(
        session?.access_token ?? "",
        !!session && !profileLoading && onboardingCompleted,
    );
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

    if (authLoading || loading) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar variant="parent" userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
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
                <AppSidebar variant="parent" userName={userName} activeItem="home" onSignOut={handleSignOut} />
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

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar variant="parent" userName={userName} activeItem="home" onSignOut={handleSignOut} />

            <div className="flex-1 min-w-0 overflow-y-auto relative">
                <PageFade>
                <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
                    <WelcomeHeader
                        name={firstName}
                        subtitle={data.students.length > 0 ? "Here's how your students are doing." : "No students linked yet."}
                    />

                    {data.students.length > 0 ? (
                        <>
                            <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {data.students.map((student) => (
                                    <StudentCard
                                        key={student.student_id}
                                        student={student}
                                        onOpen={() => setOpenStudentId(student.student_id)}
                                    />
                                ))}
                            </section>

                            {/* Read-only usage analytics, same panel the school
                                and admin views use, scoped to this parent's
                                children by the server. */}
                            <section className="pb-10">
                                <UsageAnalyticsPanel
                                    scope="parent"
                                    accessToken={session?.access_token ?? ""}
                                    enabled={!!session}
                                />
                            </section>
                        </>
                    ) : (
                        <section className="glass-panel rounded-3xl p-10 text-center">
                            <Users className="w-10 h-10 text-muted-foreground mx-auto mb-4" />
                            <h2 className="text-xl font-semibold mb-2">No students linked yet</h2>
                            <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                                Once your child adds your email in their profile settings, their progress will appear here.
                            </p>
                        </section>
                    )}
                </main>
                </PageFade>
            </div>

            <StudentDetailSheet
                studentId={openStudentId}
                accessToken={session?.access_token ?? ""}
                onClose={() => setOpenStudentId(null)}
                scope="parent"
                fetchDetail={fetchParentStudentDetail}
            />
        </div>
    );
}
