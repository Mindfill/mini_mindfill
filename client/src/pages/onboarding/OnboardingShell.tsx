import { ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingShellProps {
    children: ReactNode;
    step: number;
    totalSteps: number;
    onBack?: () => void;
    /** Changes on every screen change — retriggers the fade in/out. */
    transitionKey: string | number;
}

export default function OnboardingShell({ children, step, totalSteps, onBack, transitionKey }: OnboardingShellProps) {
    const progressPct = totalSteps > 0 ? Math.min(100, Math.round((step / totalSteps) * 100)) : 0;

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col overflow-hidden">
            <div className="flex-1 flex flex-col relative isolate overflow-hidden">
                <div className="absolute inset-0 -z-10 bg-brand-gradient opacity-50 pointer-events-none" />

                <header className="flex items-center gap-4 px-5 sm:px-8 py-5 flex-shrink-0 relative z-10">
                    {onBack ? (
                        <button
                            onClick={onBack}
                            className="w-11 h-11 rounded-full flex items-center justify-center hover-elevate active-elevate-2 border border-border flex-shrink-0"
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="w-11 h-11 flex-shrink-0" />
                    )}
                    <Progress value={progressPct} className="h-1.5 flex-1 [&>div]:bg-primary" />
                </header>

                {/* overflow-y-auto lives on `main` itself (not a flex-centered
                    ancestor) — a flex container that both centers its content
                    AND scrolls can leave the top of tall/overflowing content
                    unreachable. The inner min-h-full wrapper centers short
                    screens and just flows (scrollable) for tall ones. */}
                <main className="flex-1 overflow-y-auto px-5 sm:px-8 pb-10 relative z-10">
                    <div className="min-h-full flex items-center justify-center py-6">
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={transitionKey}
                                initial={{ opacity: 0, y: 16 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -16 }}
                                transition={{ duration: 0.35, ease: "easeOut" }}
                                className="w-full max-w-lg"
                            >
                                {children}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </main>
            </div>
        </div>
    );
}
