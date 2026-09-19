import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { Route, Switch, useLocation } from "wouter";
import { motion } from "motion/react";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import TechcessLoader from "@/components/brand/TechcessLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ShellContext } from "./SecondaryShell";

const loadDashboard = () => import("@/pages/dashboard-secondary");
const loadLearn = () => import("@/pages/secondary/learn");
const loadChapter = () => import("@/pages/secondary/chapter");
const loadSubsection = () => import("@/pages/secondary/subsection");
const loadStart = () => import("@/pages/secondary/start");

const SecondaryDashboard = lazy(loadDashboard);
const Learn = lazy(loadLearn);
const Chapter = lazy(loadChapter);
const Subsection = lazy(loadSubsection);
const Start = lazy(loadStart);
const NotFound = lazy(() => import("@/pages/not-found"));

/**
 * One persistent frame for every /secondary/* page.
 *
 * Before this, each page rendered its own sidebar + gradient + guards, so
 * every navigation tore the whole screen down and rebuilt it: a route-chunk
 * spinner, then a page skeleton, then content. Now the frame mounts once;
 * only the page area changes, and it fades in.
 */
export default function SecondaryLayout() {
    const { session, user, isLoading: authLoading, signOut } = useAuth();
    const { userType, fullName, loading: profileLoading, refresh } = useUserProfile();
    const [location, navigate] = useLocation();
    const scrollRef = useRef<HTMLDivElement>(null);
    const accessToken = session?.access_token;

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    useEffect(() => {
        if (!profileLoading && userType && userType !== "secondary") navigate("/dashboard");
    }, [profileLoading, userType, navigate]);

    // Warm every page chunk once the student is in, so moving between pages
    // never waits on a download.
    useEffect(() => {
        if (userType !== "secondary") return;
        const idle = (cb: () => void) =>
            "requestIdleCallback" in window ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 300);
        idle(() => {
            loadDashboard();
            loadLearn();
            loadChapter();
            loadSubsection();
        });
    }, [userType]);

    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0 });
    }, [location]);

    const shell = useMemo(() => (accessToken ? { accessToken } : null), [accessToken]);
    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";
    const ready = !!shell && userType === "secondary";
    const profileFailed = !!session && !profileLoading && !userType;

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar
                variant="secondary"
                userName={userName}
                activeItem={location.startsWith("/secondary/dashboard") ? "home" : "learn"}
                onSignOut={handleSignOut}
            />
            <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto relative">
                {ready ? (
                    <ShellContext.Provider value={shell}>
                        <ErrorBoundary resetKey={location}>
                            <Suspense fallback={<TechcessLoader />}>
                                <motion.div
                                    key={location}
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ duration: 0.28, ease: "easeOut" }}
                                >
                                    <Switch>
                                        <Route path="/secondary/dashboard" component={SecondaryDashboard} />
                                        <Route path="/secondary/start" component={Start} />
                                        <Route path="/secondary/learn" component={Learn} />
                                        <Route path="/secondary/learn/:subjectId" component={Learn} />
                                        <Route path="/secondary/chapters/:chapterId" component={Chapter} />
                                        <Route path="/secondary/subsections/:subsectionId" component={Subsection} />
                                        <Route component={NotFound} />
                                    </Switch>
                                </motion.div>
                            </Suspense>
                        </ErrorBoundary>
                    </ShellContext.Provider>
                ) : profileFailed ? (
                    <div className="min-h-[60vh] flex items-center justify-center px-4">
                        <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4" role="alert">
                            <h2 className="text-xl font-semibold">Couldn't load your account</h2>
                            <p className="text-sm text-muted-foreground">Check your connection and try again.</p>
                            <button onClick={() => refresh()} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                                Try again
                            </button>
                        </div>
                    </div>
                ) : (
                    <TechcessLoader delayMs={0} />
                )}
            </div>
        </div>
    );
}
