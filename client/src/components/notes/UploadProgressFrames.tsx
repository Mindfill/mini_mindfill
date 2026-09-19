import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * What the student watches while a note uploads and is parsed (~20–40s).
 *
 * Two lines, on purpose:
 * - A big rotating phrase, shuffled from a pool and swapped every ~2.3s. It
 *   never lands on one line and stays there — the old version ran out of
 *   frames after ~17s and sat on "Almost there…" for the rest of a 33s upload,
 *   which is what made the wait feel long.
 * - A small honest stage line underneath, following the backend's real order
 *   (upload → read pages → diagrams/scans → sections), timed from measured
 *   uploads. It's an estimate, not live progress.
 *
 * The bar eases toward 95% on a curve — quick at first, slowing, never
 * "complete" until the upload actually finishes.
 */
const PHRASES = [
    "Flipping through your pages…",
    "Finding the main ideas…",
    "Untangling the equations…",
    "Studying the diagrams…",
    "Sorting your notes into topics…",
    "Highlighting the key terms…",
    "Connecting the dots…",
    "Sharpening the pencils…",
    "Reading between the lines…",
    "Lining up the headings…",
    "Squinting at the handwriting…",
    "Checking the units…",
    "Building your study path…",
    "Brewing some understanding…",
    "Tidying the margins…",
    "Mapping out the chapter…",
    "Counting the formulas…",
    "Warming up your tutor…",
];

/** [seconds after start, label] — from measured uploads (~5s read, ~15s vision, ~5s sections). */
const STAGES: [number, string][] = [
    [0, "Uploading your file"],
    [4, "Reading your pages"],
    [9, "Looking closely at diagrams and scanned pages"],
    [22, "Organising it into your note's sections"],
    [32, "Saving everything — nearly done"],
];

const ROTATE_MS = 2300;

function shuffled<T>(items: T[]): T[] {
    const a = [...items];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

export default function UploadProgressFrames() {
    const [elapsed, setElapsed] = useState(0);
    const [tick, setTick] = useState(0);
    // A fresh deck per upload; when it runs out, reshuffle — no repeats until
    // every phrase has shown once.
    const [deck, setDeck] = useState(() => shuffled(PHRASES));

    useEffect(() => {
        const started = Date.now();
        const clock = setInterval(() => setElapsed((Date.now() - started) / 1000), 250);
        const rotate = setInterval(() => setTick((t) => t + 1), ROTATE_MS);
        return () => {
            clearInterval(clock);
            clearInterval(rotate);
        };
    }, []);

    useEffect(() => {
        if (tick > 0 && tick % PHRASES.length === 0) setDeck(shuffled(PHRASES));
    }, [tick]);

    const phrase = deck[tick % deck.length];
    const stage = useMemo(() => [...STAGES].reverse().find(([at]) => elapsed >= at)![1], [elapsed]);
    // ~50% at 12s, ~80% at 28s, ~90% at 40s, asymptote 95%.
    const pct = Math.round(95 * (1 - Math.exp(-elapsed / 17)));

    return (
        <div className="w-full flex flex-col items-center justify-center py-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>

            {/* Keyed so each phrase fades in fresh. Fixed height: no layout jump. */}
            <div className="h-7 w-full flex items-center justify-center" aria-live="polite">
                <p key={tick} className="text-base font-semibold text-foreground animate-in fade-in slide-in-from-bottom-1 duration-500">
                    {phrase}
                </p>
            </div>

            <div className="w-full max-w-xs space-y-2">
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-[width] duration-300 ease-out"
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <p className="text-muted-foreground text-xs">{stage}</p>
            </div>

            <p className="text-muted-foreground/80 text-xs">Usually 20–40 seconds. You can keep this open.</p>
        </div>
    );
}
