import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";
import MicButton from "@/components/chat/MicButton";
import { useVoiceInput } from "@/hooks/use-voice-input";

/** Spec §3.6 — rounded field + 32px circular send button, pinned at the bottom. */
export default function LessonInput({
    onSend,
    disabled,
    placeholder = "Ask anything…",
}: {
    onSend: (text: string) => void;
    /** Hard disable only (out of credits, section still opening). A reply
     * streaming back does NOT disable the input — the caller queues instead. */
    disabled?: boolean;
    placeholder?: string;
}) {
    const [value, setValue] = useState("");
    const ref = useRef<HTMLTextAreaElement>(null);

    const voice = useVoiceInput();
    // Mic actually open, for the recording affordances.
    const capturing = voice.status === "listening";
    // Any live voice session, including the finalising wait — the punctuated
    // final transcript arrives during that wait and must still land in the box.
    const voiceActive = capturing || voice.status === "connecting" || voice.status === "finalising";
    // Preserves anything already typed when the mic opened.
    const baseRef = useRef("");

    useEffect(() => {
        const ta = ref.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    }, [value]);

    // Live population from the streaming transcript; the text stays editable
    // and unsent when recording stops.
    useEffect(() => {
        if (!voiceActive || !voice.transcript) return;
        setValue([baseRef.current, voice.transcript].filter(Boolean).join(" "));
    }, [voice.transcript, voiceActive]);

    const startVoice = () => {
        baseRef.current = value;
        voice.start();
    };

    const submit = () => {
        const text = value.trim();
        if (!text || disabled) return;
        if (voiceActive) voice.stop();
        onSend(text);
        setValue("");
    };

    return (
        <>
            <div
                className="flex items-end gap-2 rounded-[20px] bg-card px-3.5 py-1.5 focus-within:border-primary/50"
                style={{ border: capturing ? "0.5px solid rgb(239 68 68 / 0.5)" : "0.5px solid hsl(var(--border))" }}
            >
                <textarea
                    ref={ref}
                    rows={1}
                    value={value}
                    disabled={disabled}
                    placeholder={voice.status === "listening" ? "Listening…" : placeholder}
                    aria-label="Message TECHCESS"
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault();
                            submit();
                        }
                    }}
                    className="flex-1 bg-transparent resize-none outline-none text-[14px] py-1.5 placeholder:text-muted-foreground disabled:opacity-50 max-h-[140px] [&::-webkit-scrollbar]:hidden"
                    style={{ scrollbarWidth: "none" }}
                />
                {voice.supported && !disabled && (
                    <MicButton status={voice.status} onStart={startVoice} onStop={voice.stop} className="mb-0.5 w-8 h-8" />
                )}
                <button
                    type="button"
                    onClick={submit}
                    disabled={disabled || !value.trim()}
                    aria-label="Send"
                    className="mb-0.5 w-8 h-8 shrink-0 rounded-full bg-primary text-primary-foreground flex items-center justify-center hover:bg-primary/90 disabled:opacity-30"
                >
                    <ArrowUp className="w-4 h-4" />
                </button>
            </div>
            {voice.error && (
                <p role="status" className="text-[11px] text-center mt-1.5 text-red-700 dark:text-red-400">
                    {voice.error}
                </p>
            )}
        </>
    );
}
