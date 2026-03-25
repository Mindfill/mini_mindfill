import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { BookOpen, Clock, Play, ArrowRight, Activity } from "lucide-react";
import { fetchDashboard, DashboardResponse } from "@/lib/api";

export default function Dashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [data, setData] = useState<DashboardResponse | null>(null);

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    const loadDashboard = async () => {
        if (!session) return;

        setLoading(true);
        setError(null);
        try {
            const dashboardData = await fetchDashboard(session.access_token);
            setData(dashboardData);
        } catch (err) {
            console.error(err);
            setError("Unable to load dashboard");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session) {
            loadDashboard();
        }
    }, [session, authLoading, navigate]);

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
            <div className="min-h-screen bg-background text-foreground flex">
                <AppSidebar userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10 animate-pulse">
                        <div className="mb-4">
                            <div className="h-8 w-40 bg-muted rounded-lg"></div>
                        </div>
                        <div className="h-40 bg-card rounded-3xl w-full border border-border"></div>
                        <div className="space-y-4">
                            <div className="h-4 w-32 bg-card rounded"></div>
                            <div className="h-24 bg-card rounded-2xl w-full"></div>
                        </div>
                        <div className="space-y-4">
                            <div className="h-4 w-32 bg-card rounded"></div>
                            <div className="h-16 bg-card rounded-xl w-full"></div>
                            <div className="h-16 bg-card rounded-xl w-full"></div>
                            <div className="h-16 bg-card rounded-xl w-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="min-h-screen bg-background text-foreground flex">
                <AppSidebar userName={userName} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
                        <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
                        <p className="text-muted-foreground text-sm mb-6">There was a problem fetching your data.</p>
                        <button
                            onClick={loadDashboard}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const { continue_learning, progress, recent_sessions, next_recommended } = data;

    const progressPercent = progress.lessons_total_published > 0
        ? Math.round((progress.lessons_completed / progress.lessons_total_published) * 100)
        : 0;

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <AppSidebar
                userName={userName}
                activeItem="home"
                onSignOut={handleSignOut}
            />

            <div className="flex-1 overflow-y-auto">
                <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">

                    <div className="mb-8">
                        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
                    </div>

                    {/* 1. Continue Learning Card (Hero) */}
                    <section>
                        {continue_learning ? (
                            <div className="relative overflow-hidden rounded-3xl p-8 border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                                <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
                                    <div>
                                        <div className="flex items-center gap-2 mb-3">
                                            <span className="bg-primary/20 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
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
                                    <button
                                        onClick={() => navigate(`/lessons/${continue_learning.lesson_slug}?session=${continue_learning.session_id}`)}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-all hover:scale-[1.02] flex flex-shrink-0 items-center justify-center gap-2"
                                    >
                                        Resume Lesson <ArrowRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="rounded-3xl p-8 border border-border bg-card">
                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                    <div>
                                        <h2 className="text-2xl font-semibold mb-2">Start your first lesson</h2>
                                        <p className="text-muted-foreground">Begin learning and your progress will appear here.</p>
                                    </div>
                                    <button
                                        onClick={() => navigate("/courses")}
                                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-all hover:scale-[1.02] flex flex-shrink-0"
                                    >
                                        Start Learning
                                    </button>
                                </div>
                            </div>
                        )}
                    </section>

                    {/* 2. Progress Snapshot */}
                    <section>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Your Progress</h3>
                        <div className="rounded-2xl p-6 border border-border bg-card">
                            {progress.lessons_completed > 0 || progress.lessons_in_progress > 0 ? (
                                <div>
                                    <div className="flex justify-between items-end mb-3">
                                        <span className="text-lg font-medium">
                                            {progress.lessons_completed} of {progress.lessons_total_published} lessons completed
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
                                <p className="text-muted-foreground">You haven't completed any lessons yet. Start learning to track your progress.</p>
                            )}
                        </div>
                    </section>

                    {/* 3. Recent Sessions */}
                    <section>
                        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Recent Sessions</h3>
                        {recent_sessions.length > 0 ? (
                            <div className="grid gap-3">
                                {recent_sessions.slice(0, 5).map((session: any, i: number) => (
                                    <div key={session.session_id || i} className="group flex items-center justify-between p-4 rounded-xl border border-border bg-card hover:bg-card transition-colors">
                                        <div>
                                            <h4 className="font-medium mb-1">{session.lesson_title}</h4>
                                            <p className="text-muted-foreground text-xs">Last opened {formatRelativeTime(session.created_at)}</p>
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
                            <div className="p-6 rounded-2xl border border-border bg-card text-center">
                                <p className="text-muted-foreground mb-1">No previous sessions yet.</p>
                                <p className="text-muted-foreground text-sm">Your lesson conversations will appear here.</p>
                            </div>
                        )}
                    </section>

                    {/* 4. Explore / Start Lesson */}
                    <section className="pb-10">
                        {next_recommended ? (
                            <div className="rounded-2xl p-6 md:p-8 border border-border bg-card flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div>
                                    <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-1">Recommended Next Lesson</h3>
                                    <h4 className="text-xl font-semibold">{next_recommended.lesson_title}</h4>
                                </div>
                                <button
                                    onClick={() => navigate(`/lessons/${next_recommended.lesson_slug}`)}
                                    className="bg-white text-black hover:bg-white/90 px-6 py-3 rounded-xl font-medium transition-colors flex flex-shrink-0 items-center justify-center gap-2"
                                >
                                    <Play className="w-4 h-4 flex-shrink-0" /> Start Lesson
                                </button>
                            </div>
                        ) : (
                            <div className="rounded-2xl p-6 md:p-8 border border-border bg-card flex items-center justify-between gap-4">
                                <div>
                                    <h3 className="text-xl font-semibold mb-1">Browse Lessons</h3>
                                    <p className="text-muted-foreground text-sm">Find your next topic to master.</p>
                                </div>
                                <button
                                    onClick={() => navigate("/courses")}
                                    className="bg-white text-black hover:bg-white/90 px-6 py-3 rounded-xl font-medium transition-colors flex-shrink-0"
                                >
                                    Explore Courses
                                </button>
                            </div>
                        )}
                    </section>

                </main>
            </div>
        </div>
    );
}
