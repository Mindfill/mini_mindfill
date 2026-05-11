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
        <div className="border-t border-white/5 bg-black/40 backdrop-blur-xl p-6 md:p-8">
            <div className="max-w-3xl mx-auto">
                <div className="flex items-end gap-3 rounded-3xl border border-white/5 bg-white/5 px-6 py-4 focus-within:border-white/10 transition-all duration-300 shadow-2xl">
                    <textarea
                        ref={textareaRef}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask TECHCESS anything…"
                        disabled={disabled}
                        rows={1}
                        className="flex-1 bg-transparent text-white text-[15px] resize-none outline-none placeholder:text-white/20 disabled:opacity-50 disabled:cursor-not-allowed max-h-[200px] py-1"
                        data-testid="chat-input"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={disabled || !value.trim()}
                        className="w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 bg-white text-black hover:bg-white/90 disabled:opacity-20 disabled:cursor-not-allowed transition-all duration-300 shadow-xl"
                        data-testid="chat-send"
                    >
                        <Send className="w-4 h-4" />
                    </button>
                </div>
                <p className="text-[10px] font-bold tracking-widest uppercase text-white/10 text-center mt-4">
                    TECHCESS may produce inaccurate information. Verify important facts.
                </p>
            </div>
        </div>
    );
}