import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";

interface ChatInputProps {
    onSend: (content: string) => void;
    disabled?: boolean;
}

export default function ChatInput({ onSend, disabled = false }: ChatInputProps) {
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
        <div className="bg-background px-3 md:px-6 pt-2 pb-3">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-2 rounded-3xl border border-border bg-muted px-4 py-2.5 focus-within:border-primary/40 transition-colors">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask TECHCESS anything…"
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-foreground text-[15px] resize-none outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed max-h-[160px] py-1.5"
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
                <p className="text-[10px] text-muted-foreground/40 text-center mt-1.5">
                    TECHCESS may produce inaccurate information. Verify important facts.
                </p>
            </div>
        </div>
    );
}