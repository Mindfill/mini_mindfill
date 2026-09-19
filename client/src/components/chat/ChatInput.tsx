import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
    placeholder?: string;
    /** "page" (default): full-width bar with a solid background, for chat
     * screens. "floating": no backing strip — just a frosted pill that sits
     * over a page's own background (the secondary lesson page). */
    variant?: "page" | "floating";
}

export default function ChatInput({ onSend, disabled = false, placeholder = "Ask TECHCESS anything…", variant = "page" }: ChatInputProps) {
    const floating = variant === "floating";
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        const ta = textareaRef.current;
        if (ta) {
            ta.style.height = "auto";
            ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
        }
    }, [value]);

    const handleSubmit = () => {
        const trimmed = value.trim();
        if (!trimmed || disabled) return;
        onSend(trimmed);
        setValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    };

    return (
        <div className={floating ? "pt-2 pb-4" : "bg-background px-3 md:px-6 pt-2 pb-3"}>
            <div className="max-w-3xl mx-auto">
                <div
                    className={`flex items-end gap-2 rounded-3xl border px-4 py-2.5 focus-within:border-primary/40 transition-colors ${
                        floating
                            ? "border-border/70 bg-card/75 backdrop-blur-xl shadow-[0_8px_30px_-12px_rgba(0,0,0,0.45)]"
                            : "border-border bg-muted"
                    }`}
                >
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={placeholder}
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-foreground text-[15px] resize-none outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed max-h-[160px] py-1.5 [&::-webkit-scrollbar]:hidden"
                        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                        data-testid="chat-input"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
                        data-testid="chat-send"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className={`text-[10px] text-center mt-1.5 ${floating ? "text-muted-foreground/60" : "text-muted-foreground/40"}`}>
                    TECHCESS may produce inaccurate information. Verify important facts.
                </p>
            </div>
        </div>
    );
}