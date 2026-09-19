import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { CheckCircle2, ArrowRight } from "lucide-react";
import type { Progression } from "@/lib/secondaryApi";

/** Full-screen chapter-complete moment. Continues on the button, not a timer —
 * a student who looks away shouldn't miss it. */
export default function ChapterCelebration({ progression, onContinue }: { progression: Progression; onContinue: () => void }) {
    const rootRef = useRef<HTMLDivElement>(null);
    const iconRef = useRef<HTMLDivElement>(null);
    const textRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        btnRef.current?.focus();
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (reduce) return;
        const tl = gsap.timeline();
        tl.fromTo(rootRef.current, { opacity: 0 }, { opacity: 1, duration: 0.3 })
            .fromTo(iconRef.current, { scale: 0, rotate: -30 }, { scale: 1, rotate: 0, duration: 0.7, ease: "back.out(2.2)" })
            .fromTo(textRef.current?.children ?? [], { opacity: 0, y: 16 }, { opacity: 1, y: 0, stagger: 0.12, duration: 0.4 }, "-=0.25")
            .fromTo(btnRef.current, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.35 }, "-=0.1");
        return () => {
            tl.kill();
        };
    }, []);

    const next = progression.next;

    return (
        <div
            ref={rootRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="chapter-complete-title"
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/85 backdrop-blur-md px-4"
        >
            <div className="text-center max-w-md space-y-6">
                <div ref={iconRef} className="w-24 h-24 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-14 h-14 text-emerald-700 dark:text-emerald-400" />
                </div>
                <div ref={textRef} className="space-y-2">
                    <p className="text-xs uppercase tracking-widest text-emerald-700 dark:text-emerald-400 font-semibold">
                        {progression.subject_completed ? "Subject complete" : "Chapter complete"}
                    </p>
                    <h2 id="chapter-complete-title" className="text-3xl md:text-4xl font-semibold tracking-tight">
                        {progression.chapter_title}
                    </h2>
                    <p className="text-muted-foreground">
                        {next ? `Up next: ${next.chapter_title}` : "You've finished everything available for now."}
                    </p>
                </div>
                <button
                    ref={btnRef}
                    onClick={onContinue}
                    className="min-h-[52px] px-8 rounded-full bg-primary text-primary-foreground font-semibold inline-flex items-center gap-2"
                >
                    {next ? "Keep going" : "Back to chapters"} <ArrowRight className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
