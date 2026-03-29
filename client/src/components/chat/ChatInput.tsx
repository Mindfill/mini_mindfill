import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
    const [value, setValue] = useState("");
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Auto-resize textarea
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
        <div className="w-full px-2 py-4 md:px-4 md:py-6 bg-background">
            <div className="max-w-3xl mx-auto">
                <div
                    className="
            flex items-end gap-2 md:gap-3 rounded-2xl md:rounded-3xl
            border border-border/50 dark:border-white/10
            bg-card/50 dark:bg-black/30
            backdrop-blur-xl backdrop-saturate-150
            shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)]
            px-3 py-2 md:px-4 md:py-3
            focus-within:border-primary/40 focus-within:ring-1 focus-within:ring-primary/20
            transition-all duration-300
          "
                >
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Mindfill anything…"
                        disabled={disabled}
                        rows={1}
                        className="
              flex-1 bg-transparent text-foreground text-base md:text-sm resize-none
              outline-none placeholder:text-muted-foreground/70
              disabled:opacity-50 disabled:cursor-not-allowed
              max-h-[200px] py-1.5 md:py-1
            "
                        data-testid="chat-input"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        className="
              w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center flex-shrink-0
              bg-primary/90 hover:bg-primary text-black
              disabled:opacity-30 disabled:cursor-not-allowed
              transition-all duration-200
            "
                        data-testid="chat-send"
                    >
                        <Send className="w-4 h-4 md:w-5 md:h-5 ml-[-2px]" />
                    </button>
                </div>
                <p className="text-[10px] md:text-[11px] text-muted-foreground/60 text-center mt-2 px-4">
                    Mindfill may produce inaccurate information. Verify important facts.
                </p>
            </div>
        </div>
    );
}
