import ChatContent from "@/components/chat/ChatContent";
import mindfillIcon from "@/assets/mindfill.png";

interface ChatBubbleProps {
    role: "user" | "assistant" | "developer";
    content: string;
    /** Session for polling this message's [VIZ:N] videos (assistant messages). */
    sessionId?: string;
    /** History messages lazy-load their videos on scroll. */
    isHistory?: boolean;
}

export default function ChatBubble({ role, content, sessionId, isHistory }: ChatBubbleProps) {
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
                    <ChatContent content={content} sessionId={sessionId} isHistory={isHistory} />
                </div>
            </div>
        </div>
    );
}
