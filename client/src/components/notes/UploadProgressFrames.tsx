import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

/**
 * A looping sequence of status frames shown while a note uploads + parses.
 * Purely cosmetic — it advances on a timer to reduce perceived wait time; it
 * does not reflect real backend progress. Frames advance and hold on the last
 * one (the spinner keeps moving) so the sequence never appears to go backwards.
 */
const DEFAULT_FRAMES = [
    "Uploading your notes…",
    "Reading through the pages…",
    "Understanding your subject…",
    "Simplifying the concepts…",
    "Organizing the key ideas…",
    "Preparing your lessons…",
    "Almost there…",
];

interface UploadProgressFramesProps {
    frames?: string[];
    /** ms each frame stays before advancing. */
    interval?: number;
}

export default function UploadProgressFrames({
    frames = DEFAULT_FRAMES,
    interval = 2400,
}: UploadProgressFramesProps) {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        setIndex(0);
        const id = setInterval(() => {
            // Advance, but clamp on the final frame (don't loop back to "Uploading").
            setIndex((i) => (i >= frames.length - 1 ? i : i + 1));
        }, interval);
        return () => clearInterval(id);
    }, [frames, interval]);

    // Ease the bar toward ~92% across the frames, then hold — never "complete"
    // until the upload actually resolves and the modal switches to success.
    const pct = Math.min(92, Math.round(((index + 1) / frames.length) * 92));

    return (
        <div className="w-full flex flex-col items-center justify-center py-6 text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary animate-spin" />
            </div>

            {/* Crossfading frame text. Fixed height so the layout doesn't jump. */}
            <div className="relative h-6 w-full">
                {frames.map((frame, i) => (
                    <p
                        key={i}
                        className={`absolute inset-0 text-base font-semibold text-foreground transition-opacity duration-500 ${
                            i === index ? "opacity-100" : "opacity-0"
                        }`}
                    >
                        {frame}
                    </p>
                ))}
            </div>

            {/* Estimated-progress bar (does not represent real backend progress). */}
            <div className="h-1.5 w-full max-w-xs bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${pct}%` }}
                />
            </div>

            <p className="text-muted-foreground text-xs">
                Parsing can take up to a minute for large PDFs — hang tight.
            </p>
        </div>
    );
}
