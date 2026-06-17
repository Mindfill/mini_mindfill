import MarkdownLatex from "@/components/ui/markdown-latex";
import mindfillIcon from "/images/mindfill.png";

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
                <img
                    src={mindfillIcon}
                    alt={isUser ? "User" : "TECHCESS"}
                    className={`
                        w-8 h-8 rounded-lg flex-shrink-0 object-cover
                        ${isUser ? "" : "shadow-lg"}
                    `}
                />

                {/* Message bubble */}
                <div
                    className={`
                        rounded-2xl px-5 py-4 text-[15px] leading-relaxed
                        ${isUser
                            ? "bg-muted border border-border text-foreground rounded-tr-sm"
                            : "bg-card border border-border text-foreground rounded-tl-sm backdrop-blur-sm"
                        }
                    `}
                >
                    <MarkdownLatex content={content} />
                </div>
            </div>
        </div>
    );
}
