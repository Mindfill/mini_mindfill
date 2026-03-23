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
                        w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold
                        ${isUser
                            ? "bg-primary/20 text-primary"
                            : "bg-muted text-primary shadow-sm"
                        }
                    `}
                >
                    {isUser ? "Y" : "M"}
                </div>

                {/* Message bubble */}
                <div
                    className={`
                        rounded-2xl px-5 py-4 text-sm leading-relaxed
                        ${isUser
                            ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
                            : "bg-card border border-border text-foreground rounded-tl-sm shadow-sm"
                        }
                    `}
                >
                    <MarkdownLatex content={content} />
                </div>
            </div>
        </div>
    );
}
