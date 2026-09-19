import ChatContent from "@/components/chat/ChatContent";
import type { KeyTerm } from "@/lib/keywordHighlight";
import type { NoteFigure } from "@/lib/api";
import mindfillIcon from "@/assets/mindfill.png";

interface ChatBubbleProps {
    role: "user" | "assistant" | "developer";
    content: string;
    /** Session for polling this message's [VIZ:N] videos (assistant messages). */
    sessionId?: string;
    /** History messages lazy-load their videos on scroll. */
    isHistory?: boolean;
    /** Feature 05 — omit for the live-streaming bubble; only committed messages get highlighted. */
    keyTerms?: KeyTerm[];
    /** §2.3 — the note's figures, for inline [FIGURE:n] (notes chat only). */
    figures?: Record<number, NoteFigure>;
}

export default function ChatBubble({ role, content, sessionId, isHistory, keyTerms, figures }: ChatBubbleProps) {
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

                {/* Message bubble. min-w-0: as a flex item it would otherwise
                    refuse to shrink below its widest child — one long code
                    line or equation widened the bubble past the screen and
                    gave the whole chat a sideways scroll. With it, that
                    content scrolls inside its own box instead. */}
                <div
                    className={`
                        min-w-0 rounded-2xl px-4 sm:px-5 py-4 text-[15px] leading-relaxed
                        ${isUser
                            ? "bg-muted border border-border text-foreground rounded-tr-sm"
                            : "bg-card border border-border text-foreground rounded-tl-sm backdrop-blur-sm"
                        }
                    `}
                >
                    <ChatContent content={content} sessionId={sessionId} isHistory={isHistory} keyTerms={role === "assistant" ? keyTerms : undefined}
                        figures={role === "assistant" ? figures : undefined}
                    />
                </div>
            </div>
        </div>
    );
}
