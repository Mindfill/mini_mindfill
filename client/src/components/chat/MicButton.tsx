import { Loader2, Mic, Square } from "lucide-react";
import type { VoiceStatus } from "@/hooks/use-voice-input";

/**
 * Mic toggle for the chat inputs. States the student can tell apart at a
 * glance: idle mic, a spinner while the socket opens, a red stop square while
 * their speech is being transcribed, and the spinner again for the moment it
 * takes to punctuate what they said.
 *
 * Renders nothing when the browser can't capture audio, voice is switched off
 * server-side, or they aren't on a paid plan — an inert mic button is worse
 * than no mic button.
 */
export default function MicButton({
    status,
    onStart,
    onStop,
    className = "w-9 h-9",
}: {
    status: VoiceStatus;
    onStart: () => void;
    onStop: () => void;
    /** Sizing only — the two inputs use different button sizes. */
    className?: string;
}) {
    if (status === "unavailable") return null;

    const live = status === "listening";
    // Both ends of the session show a spinner: opening the socket, and the
    // brief wait for the punctuated final transcript.
    const busy = status === "connecting" || status === "finalising";

    return (
        <button
            type="button"
            onClick={live || busy ? onStop : onStart}
            aria-label={
                live
                    ? "Stop recording"
                    : status === "connecting"
                      ? "Starting microphone"
                      : status === "finalising"
                        ? "Finishing transcription"
                        : "Speak your message"
            }
            aria-pressed={live}
            className={`${className} rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                live
                    ? "bg-red-500 text-white hover:bg-red-600"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/10"
            }`}
            data-testid="chat-mic"
        >
            {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
            ) : live ? (
                <Square className="w-3.5 h-3.5 fill-current" />
            ) : (
                <Mic className="w-4 h-4" />
            )}
        </button>
    );
}
