import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import { BorderBeam } from "@/components/ui/border-beam";
import { GlassButton } from "@/components/ui/glass-button";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import StreakBadge from "@/components/dashboard/StreakBadge";
import UsageGraphCard from "@/components/dashboard/UsageGraphCard";
import { BookOpen, Clock, Play, ArrowRight, FileText } from "lucide-react";
import { fetchDashboard, DashboardResponse } from "@/lib/api";

export default function UniversityDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const { onboardingCompleted, fullName, loading: profileLoading } = useUserProfile();
    const [, navigate] = useLocation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardResponse | null>(null);

    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    const firstName = userName.split(" ")[0];

    const loadDashboard = async (isRetry = false) => {
        if (!session) return;

        if (!isRetry) setLoading(true);
        setError(null);
        try {
            const dashboardData = await fetchDashboard(session.access_token);
            setData(dashboardData);
            setLoading(false);
        } catch (err) {
            if (!isRetry) {
                // A brief failure right after finishing onboarding (or any
                // other transient hiccup) resolves itself on a silent retry —
                // most users never see this at all, no manual refresh needed.
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

        // Wait for onboarding status to resolve before hitting a gated
        // endpoint — otherwise a not-yet-onboarded user (or the moment right
        // after completing onboarding) can see an error flash instead of the
        // redirect UserProfileProvider is about to perform.
        if (session && !profileLoading && onboardingCompleted) {
            loadDashboard();
        }
    }, [session, authLoading, navigate, profileLoading, onboardingCompleted]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    const formatRelativeTime = (isoString: string) => {
        const date = new Date(isoString);
        const now = new Date();
        const diffInMs = now.getTime() - date.getTime();
        const diffInMinutes = Math.floor(diffInMs / (1000 * 60));

        if (diffInMinutes < 1) return "Just now";
        if (diffInMinutes < 60) return `${diffInMinutes} minute${diffInMinutes === 1 ? '' : 's'} ago`;

        const diffInHours = Math.floor(diffInMinutes / 60);
        if (diffInHours < 24) return `${diffInHours} hour${diffInHours === 1 ? '' : 's'} ago`;

        const diffInDays = Math.floor(diffInHours / 24);
        return `${diffInDays} day${diffInDays === 1 ? '' : 's'} ago`;
    };

    if (authLoading || loading) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 overflow-y-auto relative">
                    <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-8 animate-pulse">
                        <div className="h-8 w-64 bg-muted rounded-lg"></div>
                        <div className="h-48 bg-card rounded-3xl w-full border border-border"></div>
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="h-32 bg-card rounded-2xl border border-border"></div>
                            <div className="h-32 bg-card rounded-2xl border border-border"></div>
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
                <AppSidebar userName={userName} activeItem="home" onSignOut={handleSignOut} />
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

    const { continue_learning, progress, recent_sessions, next_recommended, recent_notes, streak, usage_graph } = data;

    const progressPercent = progress.lessons_total_published > 0
        ? Math.round((progress.lessons_completed / progress.lessons_total_published) * 100)
        : 0;

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar userName={userName} activeItem="home" onSignOut={handleSignOut} />

            <div className="flex-1 overflow-y-auto relative">
                <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <WelcomeHeader name={firstName} subtitle="Here's where you left off." />
                        <StreakBadge currentStreak={streak.current_streak} longestStreak={streak.longest_streak} />
                    </div>

                    {/* Continue Learning Hero */}
                    <section className="relative rounded-3xl">
                        <BorderBeam size="md" colorVariant="ocean" theme="auto">
                            {continue_learning ? (
                                <div className="relative overflow-hidden rounded-3xl p-8 glass-panel">
                                    <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                                        <div>
                                            <div className="flex items-center gap-2 mb-3">
                                                <span className="bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                                                    Continue Learning
                                                </span>
                                            </div>
                                            <h2 className="text-2xl md:text-3xl font-semibold mb-2">
                                                {continue_learning.lesson_title}
                                            </h2>
                                            <p className="text-muted-foreground text-sm flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                Last active {formatRelativeTime(continue_learning.last_activity_at)}
                                            </p>
                                        </div>
                                        <GlassButton
                                            onClick={() => navigate(`/lessons/${continue_learning.lesson_slug}?session=${continue_learning.session_id}`)}
                                            contentClassName="flex items-center gap-2"
                                        >
                                            Resume Lesson <ArrowRight className="w-4 h-4" />
                                        </GlassButton>
                                    </div>
                                </div>
                            ) : (
                                <div className="rounded-3xl p-8 glass-panel">
                                    <div className="flex flex-col md:flex-row items-center md:items-center justify-between gap-6 text-center md:text-left">
                                        <div>
                                            <h2 className="text-2xl font-semibold mb-2">Start your first lesson</h2>
                                            <p className="text-muted-foreground">Begin learning and your progress will appear here.</p>
                                        </div>
                                        <GlassButton onClick={() => navigate("/courses")}>
                                            Start Learning
                                        </GlassButton>
                                    </div>
                                </div>
                            )}
                        </BorderBeam>
                    </section>

                    {/* Usage graph + Progress */}
                    <section className="grid md:grid-cols-2 gap-4">
                        <UsageGraphCard usage={usage_graph} />
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Your Progress</h3>
                            {progress.lessons_completed > 0 || progress.lessons_in_progress > 0 ? (
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-lg font-medium">
                                            {progress.lessons_completed} of {progress.lessons_total_published} lessons
                                        </span>
                                        <span className="text-primary font-semibold">{progressPercent}%</span>
                                    </div>
                                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                    <div className="mt-4 flex gap-6 text-sm">
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full bg-primary"></div>
                                            Completed ({progress.lessons_completed})
                                        </div>
                                        <div className="flex items-center gap-2 text-muted-foreground">
                                            <div className="w-2 h-2 rounded-full bg-muted"></div>
                                            In Progress ({progress.lessons_in_progress})
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-muted-foreground">You haven't completed any lessons yet.</p>
                            )}
                        </div>
                    </section>

                    {/* Recent Sessions */}
                    <section>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Sessions</h3>
                        {recent_sessions.length > 0 ? (
                            <div className="grid gap-3">
                                {recent_sessions.slice(0, 5).map((session, i) => (
                                    <div key={session.session_id || i} className="group flex items-center justify-between p-4 rounded-xl glass-panel hover:brightness-105 transition-all">
                                        <div>
                                            <h4 className="font-medium mb-1">{session.lesson_title}</h4>
                                            <p className="text-muted-foreground text-xs">Last chatted {formatRelativeTime(session.last_activity_at)}</p>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/lessons/${session.lesson_slug}?session=${session.session_id}`)}
                                            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                        >
                                            [Resume]
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="p-6 rounded-2xl glass-panel text-center">
                                <p className="text-muted-foreground mb-1">No previous sessions yet.</p>
                                <p className="text-muted-foreground text-sm">Your lesson conversations will appear here.</p>
                            </div>
                        )}
                    </section>

                    {/* Recent Notes */}
                    {recent_notes.length > 0 && (
                        <section>
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Notes</h3>
                            <div className="grid gap-3">
                                {recent_notes.map((note) => (
                                    <div key={note.note_id} className="group flex items-center justify-between p-4 rounded-xl glass-panel hover:brightness-105 transition-all">
                                        <div className="flex items-center gap-3">
                                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                                            <div>
                                                <h4 className="font-medium mb-0.5">{note.title}</h4>
                                                <p className="text-muted-foreground text-xs">Last chatted {formatRelativeTime(note.last_opened_at)}</p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/notes/${note.note_id}`)}
                                            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                                        >
                                            [Open]
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Explore / Start Lesson */}
                    <section className="pb-10">
                        {next_recommended ? (
                            <div className="rounded-2xl p-6 md:p-8 glass-panel flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-1">Recommended Next Lesson</h3>
                                    <h4 className="text-xl font-semibold">{next_recommended.lesson_title}</h4>
                                </div>
                                <GlassButton onClick={() => navigate(`/lessons/${next_recommended.lesson_slug}`)} contentClassName="flex items-center gap-2">
                                    <Play className="w-4 h-4 flex-shrink-0" /> Start Lesson
                                </GlassButton>
                            </div>
                        ) : (
                            <div className="rounded-2xl p-6 md:p-8 glass-panel flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold mb-1">Browse Lessons</h3>
                                    <p className="text-muted-foreground text-sm">Find your next topic to master.</p>
                                </div>
                                <GlassButton onClick={() => navigate("/courses")} contentClassName="flex items-center gap-2">
                                    <BookOpen className="w-4 h-4" /> Explore Courses
                                </GlassButton>
                            </div>
                        )}
                    </section>

                </main>
            </div>
        </div>
    );
}
