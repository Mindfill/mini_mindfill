import { useEffect, useState } from "react";

/**
 * Shown in the conversation while the tutor prepares its opening — on a
 * section's first open that includes building its lesson plan (~3–5s).
 * A rotating phrase, like UploadProgressFrames, instead of the full-screen
 * loader: the lesson screen is already there, only the first message is
 * on its way.
 */
const PHRASES = [
    "Reading this section…",
    "Finding the core idea…",
    "Picking out the key terms…",
    "Spotting the usual mix-ups…",
    "Looking at the diagrams…",
    "Choosing where to start…",
    "Thinking of a good first question…",
];

const REVIEW_PHRASES = [
    "Looking back over this section…",
    "Remembering where you got stuck…",
    "Finding a fresh angle…",
    "Choosing where to start…",
];

const ROTATE_MS = 1600;

export default function LessonPreparing({ review = false }: { review?: boolean }) {
    const phrases = review ? REVIEW_PHRASES : PHRASES;
    const [i, setI] = useState(0);

    useEffect(() => {
        // Walk the list once, then hold on the last line — it's never more
        // than a few seconds, and looping back to "Reading…" would read as a restart.
        const t = setInterval(() => setI((n) => Math.min(n + 1, phrases.length - 1)), ROTATE_MS);
        return () => clearInterval(t);
    }, [phrases.length]);

    return (
        <div className="w-full" aria-live="polite">
            <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground mb-1.5">TECHCESS</p>
            <div className="flex items-center gap-2.5 h-6">
                <span className="relative flex w-2 h-2 shrink-0" aria-hidden="true">
                    <span className="absolute inline-flex h-full w-full rounded-full bg-primary opacity-60 animate-ping" />
                    <span className="relative inline-flex w-2 h-2 rounded-full bg-primary" />
                </span>
                <p key={i} className="text-[13px] text-muted-foreground animate-in fade-in slide-in-from-bottom-1 duration-500">
                    {phrases[i]}
                </p>
            </div>
        </div>
    );
}
