import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { useSecondaryShell } from "@/components/secondary/SecondaryShell";
import TechcessLoader from "@/components/brand/TechcessLoader";
import { secondaryKeys } from "@/lib/secondaryQueries";
import { BorderBeam } from "@/components/ui/border-beam";
import WelcomeHeader from "@/components/dashboard/WelcomeHeader";
import StreakBadge from "@/components/dashboard/StreakBadge";
import UsageGraphCard from "@/components/dashboard/UsageGraphCard";
import { TrendingUp, TrendingDown, AlertTriangle, Sparkles } from "lucide-react";
import {
    fetchSecondaryDashboard,
    fetchSecondaryUsageGraph,
    SecondaryDashboardResponse,
    UsageGraphWindow,
    UsagePeriod,
} from "@/lib/api";

/** Rendered inside SecondaryLayout, which owns the sidebar, background and
 * the signed-in / secondary-account guards. */
export default function SecondaryDashboard() {
    const { user } = useAuth();
    const { fullName, onboardingCompleted } = useUserProfile();
    const { accessToken } = useSecondaryShell();
    const [, navigate] = useLocation();
    // The dashboard payload already carries the daily window, so only the
    // weekly one is fetched — once, then cached for the rest of the visit.
    const [usagePeriod, setUsagePeriod] = useState<UsagePeriod>("daily");
    const [weeklyUsage, setWeeklyUsage] = useState<UsageGraphWindow | null>(null);
    const [usageLoading, setUsageLoading] = useState(false);

    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "there";
    const firstName = userName.split(" ")[0];

    // Cached: returning Home shows the last dashboard instantly and refreshes
    // it behind the scenes instead of blanking to a loading state every visit.
    const { data, isPending, isError, refetch } = useQuery<SecondaryDashboardResponse>({
        queryKey: secondaryKeys.dashboard(),
        queryFn: () => fetchSecondaryDashboard(accessToken),
        enabled: onboardingCompleted,
        staleTime: 30_000,
        gcTime: 30 * 60_000,
        refetchOnMount: "always",
        retry: 1,
        retryDelay: 800,
    });

    useEffect(() => {
        document.title = "Home | TECHCESS";
    }, []);

    const handlePeriodChange = async (period: UsagePeriod) => {
        setUsagePeriod(period);
        if (period !== "weekly" || weeklyUsage) return;
        setUsageLoading(true);
        try {
            setWeeklyUsage(await fetchSecondaryUsageGraph("weekly", accessToken));
        } catch (err) {
            console.error(err);
            setUsagePeriod("daily");
        } finally {
            setUsageLoading(false);
        }
    };

    if (isPending && !data) return <TechcessLoader />;

    if (isError && !data) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-8">
                <div className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center">
                    <h2 className="text-xl font-semibold mb-2">Unable to load dashboard</h2>
                    <p className="text-muted-foreground text-sm mb-6">There was a problem fetching your data.</p>
                    <button
                        onClick={() => refetch()}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }
    if (!data) return <TechcessLoader />;

    const {
        continue_learning, chapter_rings, streak, usage_graph, strengths, weaknesses,
        most_pressing, days_since_last_session, recently_completed_chapters, next_chapter_preview,
    } = data;

    return (
        <>
            <div>
                <main className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">

                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <WelcomeHeader
                            name={firstName}
                            subtitle={
                                days_since_last_session === null
                                    ? "Ready to start your first chapter?"
                                    : days_since_last_session > 2
                                        ? `It's been ${days_since_last_session} days — let's get back to it.`
                                        : "Here's where you left off."
                            }
                        />
                        <StreakBadge currentStreak={streak.current_streak} longestStreak={streak.longest_streak} />
                    </div>

                    {/* Continue learning */}
                    <section className="relative rounded-3xl">
                        <BorderBeam size="md" colorVariant="ocean" theme="auto">
                            <div className="rounded-3xl p-8 glass-panel">
                                {continue_learning ? (
                                    <>
                                        <span className="bg-primary/15 text-primary text-xs font-medium px-2.5 py-1 rounded-full">
                                            {continue_learning.section_label}
                                        </span>
                                        <h2 className="text-2xl md:text-3xl font-semibold mt-3 mb-1">
                                            {continue_learning.subsection_title}
                                        </h2>
                                        <p className="text-muted-foreground text-sm">{continue_learning.chapter_title}</p>
                                        <button
                                            onClick={() => navigate(`/secondary/subsections/${continue_learning.subsection_id}`)}
                                            className="mt-5 min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium"
                                            data-testid="button-continue-learning"
                                        >
                                            Continue →
                                        </button>
                                    </>
                                ) : (
                                    <>
                                        <h2 className="text-2xl font-semibold mb-2">Start with Chapter 0</h2>
                                        <p className="text-muted-foreground">Mental Models is free and always unlocked — a great place to begin.</p>
                                        <button
                                            onClick={() => navigate("/secondary/start")}
                                            className="mt-5 min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium"
                                            data-testid="button-start-learning"
                                        >
                                            Start learning →
                                        </button>
                                    </>
                                )}
                            </div>
                        </BorderBeam>
                    </section>

                    {/* Usage + chapter progress */}
                    <section className="grid md:grid-cols-2 gap-4">
                        <UsageGraphCard
                            usage={usagePeriod === "weekly" && weeklyUsage ? weeklyUsage : usage_graph}
                            period={usagePeriod}
                            onPeriodChange={handlePeriodChange}
                            loading={usageLoading}
                        />
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4">Chapter Progress</h3>
                            {chapter_rings.length > 0 ? (
                                <div className="space-y-3 max-h-40 overflow-y-auto pr-1">
                                    {chapter_rings.map((ring) => (
                                        <div key={ring.chapter_id}>
                                            <div className="flex justify-between text-sm mb-1">
                                                <span className={ring.is_complete ? "text-foreground" : "text-muted-foreground"}>
                                                    {ring.chapter_title}
                                                </span>
                                                <span className="text-muted-foreground">{Math.round(ring.percent_complete)}%</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-700 ${ring.is_complete ? "bg-emerald-500" : "bg-primary"}`}
                                                    style={{ width: `${ring.percent_complete}%` }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-muted-foreground text-sm">Chapters will appear here once your curriculum is live.</p>
                            )}
                        </div>
                    </section>

                    {/* Strengths & weaknesses */}
                    <section className="grid md:grid-cols-2 gap-4">
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingUp className="w-4 h-4 text-emerald-700 dark:text-emerald-400" /> Strengths
                            </h3>
                            {strengths.length > 0 ? (
                                <ul className="space-y-2">
                                    {strengths.map((s) => (
                                        <li key={s.chapter_title} className="text-sm font-medium">{s.chapter_title}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-sm">Keep studying — strengths show up here as you go.</p>
                            )}
                        </div>
                        <div className="glass-panel rounded-2xl p-6">
                            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2">
                                <TrendingDown className="w-4 h-4 text-amber-700 dark:text-amber-400" /> Needs Work
                            </h3>
                            {weaknesses.length > 0 ? (
                                <ul className="space-y-2">
                                    {weaknesses.map((w) => (
                                        <li key={w.chapter_title} className="text-sm font-medium">{w.chapter_title}</li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="text-muted-foreground text-sm">Nothing flagged yet.</p>
                            )}
                        </div>
                    </section>

                    {most_pressing && (
                        <section className="rounded-2xl p-5 glass-panel border border-amber-500/30 flex items-center gap-3">
                            <AlertTriangle className="w-5 h-5 text-amber-700 dark:text-amber-400 flex-shrink-0" />
                            <p className="text-sm">
                                <span className="font-semibold">{most_pressing.chapter_title}</span> is worth revisiting — it's a
                                foundation for what's coming up next.
                            </p>
                        </section>
                    )}

                    {(recently_completed_chapters.length > 0 || next_chapter_preview) && (
                        <section className="grid md:grid-cols-2 gap-4 pb-10">
                            {recently_completed_chapters.length > 0 && (
                                <div className="glass-panel rounded-2xl p-6">
                                    <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <Sparkles className="w-4 h-4 text-primary" /> Recently Completed
                                    </h3>
                                    <ul className="space-y-1.5">
                                        {recently_completed_chapters.map((title) => (
                                            <li key={title} className="text-sm font-medium">{title}</li>
                                        ))}
                                    </ul>
                                </div>
                            )}
                            {next_chapter_preview && (
                                <div className="glass-panel rounded-2xl p-6">
                                    <h3 className="text-sm font-medium text-primary uppercase tracking-wider mb-2">Up Next</h3>
                                    <p className="text-sm font-medium">{next_chapter_preview}</p>
                                </div>
                            )}
                        </section>
                    )}

                </main>
            </div>
        </>
    );
}
