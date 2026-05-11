import MarkdownLatex from "@/components/ui/markdown-latex";

interface ChatBubbleProps {
    role: "user" | "assistant";
    content: string;
}

export default function ChatBubble({ role, content }: ChatBubbleProps) {
    const isUser = role === "user";

    return (
        <div
            className={`flex ${isUser ? "justify-end" : "justify-start"} w-full`}
        >
            <div
                className={`flex items-start gap-3 ${isUser ? "flex-row-reverse max-w-[75%]" : "max-w-3xl w-full"}`}
            >
                {/* Avatar */}
                <div
                    className={`
                        w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-[10px] font-black italic
                        ${isUser
                            ? "bg-white/10 text-white/40"
                            : "bg-primary text-white shadow-lg"
                        }
                    `}
                >
                    {isUser ? "Y" : "T"}
                </div>

                {/* Message bubble */}
                <div
                    className={`
                        rounded-2xl px-5 py-4 text-[15px] leading-relaxed
                        ${isUser
                            ? "bg-white/5 border border-white/5 text-white/90 rounded-tr-sm"
                            : "bg-white/5 border border-white/5 text-white/80 rounded-tl-sm backdrop-blur-sm"
                        }
                    `}
                >
                    <MarkdownLatex content={content} />
                </div>
            </div>
        </div>
    );
}
