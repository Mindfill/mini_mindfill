import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import PendingMessages from "@/components/chat/PendingMessages";
import TypingIndicator from "@/components/chat/TypingIndicator";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { useSendQueue } from "@/hooks/use-send-queue";
import {
    fetchPracticeChat,
    SecondaryApiError,
    streamPracticeExplain,
    type PracticeQuestion,
    type SecondaryMessage,
} from "@/lib/secondaryApi";

/**
 * "Ask tutor" on one practice question — the same bottom sheet as the
 * end-of-chapter problem tutor (ProblemTutorSheet in EndOfChapter.tsx).
 *
 * The conversation is saved per student per QUESTION, so closing the sheet,
 * leaving the quiz, or meeting the same question in a later quiz all pick it
 * up where it was. The tutor can attach visuals ([VIZ:N]); they render in the
 * background and appear here when ready — even if the student closed the
 * sheet in the meantime and came back.
 */
export default function PracticeTutorSheet({
    quizId,
    question,
    accessToken,
    open,
    onOpenChange,
}: {
    quizId: string;
    question: PracticeQuestion;
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [messages, setMessages] = useState<SecondaryMessage[] | null>(null);
    // The chat's id in the visuals pipeline — lets [VIZ:N] tokens find their videos.
    const [vizSessionId, setVizSessionId] = useState<string | undefined>(undefined);
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const endRef = useRef<HTMLDivElement>(null);
    // Synchronous twin of `sending` — the queue calls send() again before React
    // has re-rendered, so the state would still read true in that closure.
    const inFlight = useRef(false);
    // Which question the loaded state belongs to, so a slow load for the
    // previous question can't land on this one.
    const loadedFor = useRef<string | null>(null);

    // A different question is a different conversation — including whatever
    // was still in flight for the last one.
    useEffect(() => {
        setMessages(null);
        setError(null);
        setSending(false);
        setStreaming(null);
        inFlight.current = false;
        loadedFor.current = null;
    }, [question.id]);

    // Open: load the saved conversation; an empty one gets the tutor's opening.
    //
    // Deliberately NOT cancelled when the sheet closes: the opening is being
    // written and saved server-side either way, so it should land in this
    // sheet too — cancelling would make the next open ask for a second
    // opening while the first is still in flight. Only moving to another
    // question discards the result (loadedFor no longer matches).
    useEffect(() => {
        if (!open || messages !== null || loadedFor.current === question.id) return;
        const forQuestion = question.id;
        loadedFor.current = forQuestion;
        const current = () => loadedFor.current === forQuestion;

        (async () => {
            try {
                const chat = await fetchPracticeChat(quizId, forQuestion, accessToken);
                if (!current()) return;
                setVizSessionId(chat.viz_session_id);
                if (chat.messages.length > 0) {
                    setMessages(chat.messages);
                    return;
                }
                inFlight.current = true;
                setSending(true);
                setStreaming("");
                const opening = await streamPracticeExplain(quizId, forQuestion, null, accessToken, {
                    onContent: (c) => current() && setStreaming(c),
                });
                if (current()) setMessages([{ role: "assistant", content: opening }]);
            } catch (err) {
                if (!current()) return;
                // Another tab opened it first (or is opening it right now) —
                // show what's saved rather than an error.
                const reason = err instanceof SecondaryApiError ? err.reason : null;
                if (reason === "already_started" || reason === "busy") {
                    try {
                        const chat = await fetchPracticeChat(quizId, forQuestion, accessToken);
                        if (!current()) return;
                        if (chat.messages.length > 0) {
                            setMessages(chat.messages);
                            return;
                        }
                    } catch {
                        // fall through to the error below
                    }
                }
                // Empty but usable: the student can still type their question.
                setMessages([]);
                setError(
                    reason === "busy"
                        ? "Your tutor is still writing — close this and open it again in a moment."
                        : err instanceof Error
                          ? err.message
                          : "Your tutor couldn't respond just now",
                );
            } finally {
                // A stale result for a previous question leaves the new
                // question's state alone (the question effect already reset it).
                if (current()) {
                    inFlight.current = false;
                    setSending(false);
                    setStreaming(null);
                }
            }
        })();
    }, [open, messages, quizId, question.id, accessToken]);

    /** True only on a complete reply — gates the queue's next release. */
    const send = async (text: string): Promise<boolean> => {
        if (inFlight.current) return false;
        inFlight.current = true;
        setError(null);
        setSending(true);
        setStreaming("");
        setMessages((m) => [...(m ?? []), { role: "user", content: text }]);
        try {
            const reply = await streamPracticeExplain(quizId, question.id, text, accessToken, { onContent: setStreaming });
            setMessages((m) => [...(m ?? []), { role: "assistant", content: reply }]);
            return true;
        } catch (err) {
            // The server removes an unanswered message; the queue keeps a copy
            // with a Retry button.
            setMessages((m) => (m ?? []).slice(0, -1));
            const e = err instanceof SecondaryApiError ? err : null;
            setError(
                e?.reason === "busy"
                    ? "Your tutor is still answering your last message."
                    : err instanceof Error
                      ? err.message
                      : "Something went wrong",
            );
            return false;
        } finally {
            inFlight.current = false;
            setSending(false);
            setStreaming(null);
        }
    };

    const queue = useSendQueue(send);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, streaming, queue.pending]);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[85dvh] max-h-[85dvh] flex flex-col p-0 rounded-t-3xl">
                <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left space-y-2">
                    <SheetTitle>Ask your tutor</SheetTitle>
                    <SheetDescription asChild>
                        <div className="text-sm text-muted-foreground line-clamp-3 min-w-0">
                            <MarkdownLatex content={question.question_text} className="text-inherit [&_p]:mb-0" />
                        </div>
                    </SheetDescription>
                </SheetHeader>
                <div className="flex-1 min-w-0 overflow-y-auto px-4 py-4 space-y-4">
                    {messages === null && !streaming && !sending && (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" aria-label="Loading your conversation" />
                    )}
                    {(messages ?? []).map((m, i) => (
                        <ChatBubble
                            key={i}
                            role={m.role}
                            content={m.content}
                            sessionId={m.role === "assistant" ? vizSessionId : undefined}
                            isHistory
                        />
                    ))}
                    {/* No sessionId while streaming: these are the model's own
                        [VIZ:N] numbers, not yet the server's. */}
                    {streaming ? <ChatBubble role="assistant" content={streaming} /> : sending && <TypingIndicator />}
                    <PendingMessages pending={queue.pending} onRetry={queue.retry} onDismiss={queue.dismiss} />
                    {error && (
                        <div role="alert" className="text-sm text-red-700 dark:text-red-400 text-center">
                            {error}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
                {/* Only loading / the opening turn disables the input; a
                    streaming reply queues the next message instead. */}
                <ChatInput onSend={queue.enqueue} disabled={messages === null} />
            </SheetContent>
        </Sheet>
    );
}
