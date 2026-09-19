import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Loader2, ArrowRight, Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { NextDestination } from "@/lib/secondaryApi";

/** `--primary` is stored as "212 90% 62%"; returns a builder for a
 * comma-syntax hsla() string GSAP can interpolate, or null if unreadable. */
function primaryHsla(): ((alpha: number) => string) | null {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    const m = raw.match(/^(-?[\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%$/);
    if (!m) return null;
    return (alpha) => `hsla(${m[1]}, ${m[2]}%, ${m[3]}%, ${alpha})`;
}

/**
 * Three states:
 *  1. hidden   — the student hasn't scrolled past the static content yet
 *  2. disabled — visible, greyed, "Keep going"
 *  3. unlocked — GSAP pulse into full colour, "I'm ready →"
 */
export default function NextButton({
    visible,
    unlocked,
    busy,
    next,
    hint,
    onClick,
}: {
    visible: boolean;
    unlocked: boolean;
    busy: boolean;
    next: NextDestination | null;
    /** Shown under a disabled button, e.g. "Answer every question to continue". */
    hint?: string;
    onClick: () => void;
}) {
    const btnRef = useRef<HTMLButtonElement>(null);
    const wasUnlocked = useRef(unlocked);

    useEffect(() => {
        const el = btnRef.current;
        if (!el || !visible) return;
        const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
        if (unlocked && !wasUnlocked.current && !reduce) {
            gsap.fromTo(
                el,
                { scale: 0.94, filter: "saturate(0.2)" },
                { scale: 1, filter: "saturate(1)", duration: 0.6, ease: "elastic.out(1, 0.5)" },
            );
            // GSAP can't parse CSS variables inside colours — passing
            // "hsl(var(--primary) / 0.55)" threw inside its ticker and took the
            // page down the moment a lesson unlocked. Resolve the token first.
            const ring = primaryHsla();
            if (ring) {
                gsap.fromTo(
                    el,
                    { boxShadow: `0 0 0 0 ${ring(0.55)}` },
                    { boxShadow: `0 0 0 18px ${ring(0)}`, duration: 1.1, ease: "power2.out", repeat: 1, clearProps: "boxShadow" },
                );
            }
        }
        wasUnlocked.current = unlocked;
    }, [unlocked, visible]);

    if (!visible) return null;

    const context = next
        ? next.is_new_chapter
            ? `Chapter complete — next: ${next.chapter_title}`
            : `Next up: ${next.subsection_title}`
        : "This is the last lesson in this subject.";

    const button = (
        <button
            ref={btnRef}
            onClick={onClick}
            disabled={!unlocked || busy}
            aria-disabled={!unlocked || busy}
            className={`w-full sm:w-auto min-h-[52px] px-8 rounded-full font-semibold text-base inline-flex items-center justify-center gap-2 transition-colors ${
                unlocked
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
        >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : !unlocked && <Lock className="w-4 h-4" />}
            {unlocked ? (next ? "I'm ready" : "Finish") : "Keep going"}
            {unlocked && !busy && <ArrowRight className="w-5 h-5" />}
        </button>
    );

    return (
        <div className="flex flex-col items-center gap-2 py-6">
            {unlocked && <p className="text-sm text-muted-foreground text-center">{context}</p>}
            {unlocked ? (
                button
            ) : (
                <TooltipProvider delayDuration={150}>
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <span tabIndex={0} className="w-full sm:w-auto rounded-full">{button}</span>
                        </TooltipTrigger>
                        <TooltipContent>{hint ?? "Keep chatting with your tutor to unlock the next lesson"}</TooltipContent>
                    </Tooltip>
                </TooltipProvider>
            )}
            {!unlocked && hint && <p className="text-xs text-muted-foreground text-center sm:hidden">{hint}</p>}
        </div>
    );
}
