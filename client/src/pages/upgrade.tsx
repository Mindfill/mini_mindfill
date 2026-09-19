import { useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import PlanSelector from "@/components/billing/PlanSelector";
import { Sparkles, Check } from "lucide-react";

export default function Upgrade() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const { isPaid } = useCredits();
    const { userType } = useUserProfile();
    // "Pro" is the uni plan's name; secondary plans are just "a plan".
    const isSecondary = userType === "secondary";

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    useEffect(() => {
        document.title = "Upgrade | TECHCESS";
    }, []);

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar userName={userName} activeItem="profile" onSignOut={handleSignOut} />

            <div className="flex-1 min-w-0 overflow-y-auto relative">
                <main className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <Sparkles className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-semibold tracking-tight">
                                {isSecondary ? "Choose your plan" : "Upgrade to Pro"}
                            </h1>
                            <p className="text-muted-foreground text-sm">
                                {isSecondary ? "Unlock every chapter." : "Unlock unlimited learning."}
                            </p>
                        </div>
                    </div>

                    {isPaid ? (
                        <div className="glass-panel rounded-3xl p-8 text-center">
                            <div className="w-14 h-14 mx-auto rounded-full bg-green-500/10 text-green-700 dark:text-green-400 flex items-center justify-center mb-4">
                                <Check className="w-7 h-7" />
                            </div>
                            <h2 className="text-lg font-bold mb-1">
                                {isSecondary ? "You're subscribed" : "You're on Pro"}
                            </h2>
                            <p className="text-muted-foreground text-sm mb-6">
                                {isSecondary ? "Your plan is active." : "Your Pro plan is active."}
                            </p>
                            <button
                                onClick={() => navigate("/profile")}
                                className="bg-muted text-foreground hover:bg-muted/80 px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors"
                            >
                                Manage in profile
                            </button>
                        </div>
                    ) : (
                        <div className="glass-panel rounded-3xl p-6 md:p-8">
                            <PlanSelector />
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
