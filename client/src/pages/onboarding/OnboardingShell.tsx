import { ReactNode, useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ArrowLeft } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface OnboardingShellProps {
    children: ReactNode;
    step: number;
    totalSteps: number;
    onBack?: () => void;
    /** Changes on every screen change — retriggers the GSAP transition. */
    transitionKey: string | number;
}

export default function OnboardingShell({ children, step, totalSteps, onBack, transitionKey }: OnboardingShellProps) {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!contentRef.current) return;
        const ctx = gsap.context(() => {
            gsap.fromTo(
                contentRef.current,
                { opacity: 0, y: 16 },
                { opacity: 1, y: 0, duration: 0.5, ease: "power2.out" }
            );
        }, contentRef);
        return () => ctx.revert();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transitionKey]);

    const progressPct = totalSteps > 0 ? Math.min(100, Math.round((step / totalSteps) * 100)) : 0;

    return (
        <div className="min-h-[100dvh] w-full bg-background text-foreground flex flex-col">
            <header className="flex items-center gap-4 px-5 sm:px-8 py-5 flex-shrink-0">
                {onBack ? (
                    <button
                        onClick={onBack}
                        className="w-9 h-9 rounded-full flex items-center justify-center hover-elevate active-elevate-2 border border-border flex-shrink-0"
                        aria-label="Back"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </button>
                ) : (
                    <div className="w-9 h-9 flex-shrink-0" />
                )}
                <Progress value={progressPct} className="h-1.5 flex-1 [&>div]:bg-amber" />
            </header>

            <main className="flex-1 flex items-center justify-center px-5 sm:px-8 pb-10">
                <div ref={contentRef} className="w-full max-w-lg">
                    {children}
                </div>
            </main>
        </div>
    );
}
