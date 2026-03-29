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
        <div className="border-t border-border bg-background/60 backdrop-blur-md p-4">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-3 rounded-2xl border border-border bg-card px-4 py-3 focus-within:border-primary/30 transition-colors duration-200">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask Mindfill anything…"
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed max-h-[200px]"
                        data-testid="chat-input"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-primary text-black hover:bg-primary/90 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-200"
                        style={{
                            boxShadow: value.trim() && !disabled
                                ? "0 0 20px rgba(245, 158, 11, 0.3)"
                                : "none",
                        }}
                        data-testid="chat-send"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[11px] text-muted-foreground/60 text-center mt-2">
                    Mindfill may produce inaccurate information. Verify important facts.
                </p>
            </div>
        </div>
    );
}