import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import { Flame, TrendingUp, TrendingDown, Users, Sparkles, ArrowUpCircle } from "lucide-react";
import { fetchParentDashboard, ParentDashboardResponse, StudentSummary } from "@/lib/api";

function StudentCard({ student }: { student: StudentSummary }) {
    const isUp = student.study_minutes_change_percent > 0;
    return (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold">{student.student_name}</h3>
                    <p className="text-muted-foreground text-xs">{student.class_level}</p>
                </div>
                <div className="flex items-center gap-1.5 text-orange-500">
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
                {student.study_minutes_change_percent !== 0 && (
                    <span className={`flex items-center gap-1 text-xs font-medium ${isUp ? "text-emerald-500" : "text-muted-foreground"}`}>
                        {isUp ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                        {Math.abs(student.study_minutes_change_percent)}%
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
                            <span key={s} className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-1 rounded-full">
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
                            <span key={w} className="text-xs bg-amber-500/10 text-amber-600 dark:text-amber-400 px-2 py-1 rounded-full">
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
        </div>
    );
}

export default function ParentDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const { onboardingCompleted, fullName, loading: profileLoading } = useUserProfile();
    const [, navigate] = useLocation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<ParentDashboardResponse | null>(null);

    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    const firstName = userName.split(" ")[0];

    const loadDashboard = async (isRetry = false) => {
        if (!session) return;
        if (!isRetry) setLoading(true);
        setError(null);
        try {
            const dashboardData = await fetchParentDashboard(session.access_token);
            setData(dashboardData);
            setLoading(false);
        } catch (err) {
            if (!isRetry) {
                setTimeout(() => loadDashboard(true), 800);
                return;
            }
            console.error(err);
            setError("Unable to load dashboard");
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }
        if (session && !profileLoading && onboardingCompleted) {
            loadDashboard();
        }
    }, [session, authLoading, navigate, profileLoading, onboardingCompleted]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    if (authLoading || loading) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar variant="parent" userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 overflow-y-auto relative">
                    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 animate-pulse">
                        <div className="h-8 w-64 bg-muted rounded-lg"></div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="h-56 bg-card rounded-2xl border border-border"></div>
                            <div className="h-56 bg-card rounded-2xl border border-border"></div>
                        </div>
                    </div>
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

            <div className="flex-1 overflow-y-auto relative">
                <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
                    <WelcomeHeader
                        name={firstName}
                        subtitle={data.students.length > 0 ? "Here's how your students are doing." : "No students linked yet."}
                    />

                    {data.students.length > 0 ? (
                        <section className="grid md:grid-cols-2 gap-4 pb-10">
                            {data.students.map((student) => (
                                <StudentCard key={student.student_id} student={student} />
                            ))}
                        </section>
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
            </div>
        </div>
    );
}
