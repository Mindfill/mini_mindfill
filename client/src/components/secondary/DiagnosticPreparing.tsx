import { useEffect, useState } from "react";

/**
 * Shown while the prerequisite diagnostic is written.
 *
 * Unlike LessonPreparing, this one LOOPS. A cold cache means a real model call
 * writing five questions from several lessons' worth of material, which can run
 * past ten seconds; a list that walks once and then freezes on its last line
 * reads as a hang. Looping keeps the page honestly alive for as long as it
 * takes. (Warm cache returns almost instantly and this barely flashes.)
 *
 * The lines are in the tutor's voice — stoic, dry — so the wait is part of the
 * same conversation the exam itself is in.
 */
const PHRASES = [
    "Pulling up the lessons you skipped…",
    "Working out what they actually rest on…",
    "Deciding what's fair to ask…",
    "Writing the questions…",
    "Building the wrong answers — the tempting ones…",
    "Checking there's exactly one right answer…",
    "Shuffling things around…",
    "Nearly there. This only happens once…",
];

const ROTATE_MS = 2200;

export default function DiagnosticPreparing() {
    const [i, setI] = useState(0);

    useEffect(() => {
        const t = setInterval(() => setI((n) => (n + 1) % PHRASES.length), ROTATE_MS);
        return () => clearInterval(t);
    }, []);

    return (
        <div className="glass-panel rounded-2xl p-6 md:p-8" aria-live="polite" aria-busy="true">
            <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground mb-2">
                TECHCESS
            </p>
            <div className="flex items-center gap-2.5 min-h-[28px]">
                <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-primary" />
                </span>
                <p
                    key={i}
                    className="text-sm text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-500"
                >
                    {PHRASES[i]}
                </p>
            </div>
        </div>
    );
}
