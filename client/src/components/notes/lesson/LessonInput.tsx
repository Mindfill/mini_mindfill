import { useEffect, useRef, useState } from "react";
import { ArrowUp } from "lucide-react";

/** Spec §3.6 — rounded field + 32px circular send button, pinned at the bottom. */
export default function LessonInput({
    onSend,
    disabled,
    placeholder = "Ask anything…",
}: {
    onSend: (text: string) => void;
    disabled?: boolean;
    placeholder?: string;
}) {
    const [value, setValue] = useState("");
    const ref = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const ta = ref.current;
        if (!ta) return;
        ta.style.height = "auto";
        ta.style.height = Math.min(ta.scrollHeight, 140) + "px";
    }, [value]);

    const submit = () => {
        const text = value.trim();
        if (!text || disabled) return;
        onSend(text);
        setValue("");
    };

    return (
        <div className="flex items-end gap-2 rounded-[20px] bg-card px-3.5 py-1.5 focus-within:border-primary/50" style={{ border: "0.5px solid hsl(var(--border))" }}>
            <textarea
                ref={ref}
                rows={1}
                value={value}
                disabled={disabled}
                placeholder={placeholder}
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
    );
}
