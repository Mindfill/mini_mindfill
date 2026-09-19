import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { gsap } from "gsap";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Loader2, MessageSquare, RotateCcw } from "lucide-react";
import { lessonTextForChat } from "@/lib/lessonMarkup";
import {
    fetchSessionState,
    fetchSubsectionConversation,
    SecondaryApiError,
    sendTutorMessage,
    startSession,
    type SecondaryMessage,
    type SessionState,
} from "@/lib/secondaryApi";

const PENDING_RECHECK_MS = 6000;
const FALLBACK_PROMPT = "Let's make sure this really makes sense. In your own words, what's the main idea you just read?";

export interface TutorProgress {
    session: SessionState | null;
    /** true when a first attempt may complete (or the page is a review with no active session). */
    unlocked: boolean;
    busy: boolean;
}

type LiveSession = SessionState & { assessment_pending?: boolean };

/** Assessment results can arrive after a newer message was already sent (the
 * input re-opens on `final`, before the assessment lands). Never let an older
 * snapshot roll the session back. */
function mergeSession(current: LiveSession | null, incoming: LiveSession): LiveSession {
    if (!current || current.session_id !== incoming.session_id) return incoming;
    if (incoming.exchange_count < current.exchange_count) {
        return { ...current, unlock_ready: current.unlock_ready || incoming.unlock_ready };
    }
    return { ...incoming, unlock_ready: current.unlock_ready || incoming.unlock_ready };
}

export default function TutorChat({
    subsectionId,
    accessToken,
    chatPrompt,
    isCompleted,
    hasActiveSession,
    hasPreviousSessions,
    onProgress,
}: {
    subsectionId: string;
    accessToken: string;
    /** The authored chat prompt — the tutor's opening line, shown before the session starts. */
    chatPrompt: string | null;
    isCompleted: boolean;
    hasActiveSession: boolean;
    hasPreviousSessions: boolean;
    onProgress: (p: TutorProgress) => void;
}) {
    const [messages, setMessages] = useState<SecondaryMessage[]>([]);
    const [session, setSession] = useState<LiveSession | null>(null);
    const [starting, setStarting] = useState(false);
    const [started, setStarted] = useState(false);
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState<string | null>(null);
    const [error, setError] = useState<{ message: string; retry?: string } | null>(null);
    const dividerRef = useRef<HTMLDivElement>(null);
    const turnRef = useRef(0);
    const startingRef = useRef(false);

    const promptText = useMemo(() => lessonTextForChat(chatPrompt) || FALLBACK_PROMPT, [chatPrompt]);

    // Report unlock state upward for the Next button.
    useEffect(() => {
        const unlocked = session
            ? session.session_type === "review" || session.unlock_ready || session.exchange_count >= session.exchange_ceiling
            : isCompleted;
        onProgress({ session, unlocked, busy: sending || starting });
    }, [session, isCompleted, sending, starting, onProgress]);

    // A completed subsection shows its original conversation read-only until
    // the student chooses to review — opening the page never starts a session.
    useEffect(() => {
        if (isCompleted && !hasActiveSession && hasPreviousSessions) {
            fetchSubsectionConversation(subsectionId, accessToken).then(setMessages).catch(() => {});
        }
    }, [isCompleted, hasActiveSession, hasPreviousSessions, subsectionId, accessToken]);

    const begin = useCallback(async () => {
        if (startingRef.current) return;
        startingRef.current = true;
        setStarting(true);
        setError(null);
        try {
            const res = await startSession(subsectionId, accessToken);
            setSession(res.session);
            setMessages(res.messages);
            setStarted(true);
            const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
            if (!reduce && dividerRef.current) {
                gsap.fromTo(dividerRef.current, { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: "power2.inOut" });
            }
        } catch (err) {
            setError({ message: err instanceof Error ? err.message : "Couldn't start your tutor." });
        } finally {
            startingRef.current = false;
            setStarting(false);
        }
    }, [subsectionId, accessToken]);

    // Resume an in-progress session straight away.
    useEffect(() => {
        if (hasActiveSession && !started) begin();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasActiveSession]);

    // The assessment may still be running when the stream closes — check once more.
    useEffect(() => {
        if (!session || session.unlock_ready || session.session_type === "review" || !session.assessment_pending) return;
        const t = setTimeout(() => {
            fetchSessionState(session.session_id, accessToken)
                .then((fresh) => setSession((s) => (s ? mergeSession(s, { ...fresh, assessment_pending: false }) : s)))
                .catch(() => {});
        }, PENDING_RECHECK_MS);
        return () => clearTimeout(t);
    }, [session, accessToken]);

    const send = async (text: string) => {
        if (!session || sending) return;
        const turn = ++turnRef.current;
        const isCurrent = () => turnRef.current === turn;
        const sessionId = session.session_id;
        setError(null);
        setSending(true);
        setStreaming("");
        setMessages((m) => [...m, { role: "user", content: text }]);

        // The reply is committed the moment it's final — the input re-opens
        // then, without waiting for the assessment that follows on the stream.
        let committed = false;
        const commit = (content: string, sid: string) => {
            if (committed) return;
            committed = true;
            setMessages((m) => [...m, { role: "assistant", content, session_id: sid }]);
            setSession((s) => (s && s.session_id === sessionId ? { ...s, exchange_count: s.exchange_count + 1 } : s));
            if (isCurrent()) {
                setStreaming(null);
                setSending(false);
            }
        };

        try {
            const result = await sendTutorMessage(sessionId, text, accessToken, {
                onContent: (c) => {
                    if (isCurrent() && !committed) setStreaming(c);
                },
                onFinal: commit,
            });
            commit(result.content, result.session_id);
            if (result.session) setSession((s) => mergeSession(s, result.session!));
        } catch (err) {
            if (committed) {
                // The reply landed; only the trailing assessment was lost. Ask
                // for the session state instead of reporting an error.
                fetchSessionState(sessionId, accessToken)
                    .then((fresh) => setSession((s) => (s ? mergeSession(s, fresh) : s)))
                    .catch(() => {});
                return;
            }
            // The backend removes an unanswered message, so drop it here too
            // and offer to resend it.
            setMessages((m) => m.slice(0, -1));
            const e = err instanceof SecondaryApiError ? err : null;
            if (e?.reason === "busy") setError({ message: "Your tutor is still answering your last message." });
            else if (e?.reason === "session_not_active") {
                setError({ message: "This session ended. Starting a fresh one…" });
                setStarted(false);
                setSession(null);
                begin();
            } else setError({ message: err instanceof Error ? err.message : "Something went wrong.", retry: text });
        } finally {
            if (!committed && isCurrent()) {
                setSending(false);
                setStreaming(null);
            }
        }
    };

    const reviewing = isCompleted && !started;
    // The authored prompt stands in as the tutor's opening line ONLY for a
    // student who hasn't talked here yet — starting a session then stores that
    // same line as message one, so the bubble simply stays where it is.
    // A student coming back to an in-progress or finished lesson gets their
    // conversation instead: re-showing the opening prompt above history reads
    // as the tutor asking again.
    const isReturning = hasActiveSession || hasPreviousSessions || isCompleted;
    const showPromptPreview = !started && !isReturning && messages.length === 0;

    return (
        <section aria-label="Tutor chat" className="space-y-6 pt-4">
            <div ref={dividerRef} className="h-px w-full bg-gradient-to-r from-transparent via-primary/60 to-transparent origin-center" />

            {!started && messages.length > 0 && (
                <p className="text-center text-xs uppercase tracking-widest text-muted-foreground">Your earlier conversation</p>
            )}

            <div className="space-y-5">
                {showPromptPreview && <ChatBubble role="assistant" content={promptText} />}
                {messages.map((m, i) => (
                    <ChatBubble key={i} role={m.role} content={m.content} sessionId={m.session_id} isHistory />
                ))}
                {streaming ? <ChatBubble role="assistant" content={streaming} /> : sending && <TypingIndicator />}
            </div>

            {!started && (
                <div className="text-center py-2">
                    {hasActiveSession ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" aria-label="Resuming your conversation" />
                    ) : (
                        <button
                            onClick={begin}
                            disabled={starting}
                            className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-60"
                        >
                            {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : reviewing ? <RotateCcw className="w-4 h-4" /> : <MessageSquare className="w-4 h-4" />}
                            {reviewing ? "Review with your tutor" : "Reply to your tutor"}
                        </button>
                    )}
                </div>
            )}

            {error && (
                <div role="alert" className="flex flex-wrap items-center justify-center gap-3 text-sm text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2">
                    {error.message}
                    {error.retry && (
                        <button onClick={() => send(error.retry!)} className="underline font-medium min-h-[44px]">
                            Send again
                        </button>
                    )}
                </div>
            )}

            {started && session?.status === "active" && (
                <div className="sticky bottom-0 z-10">
                    <ChatInput onSend={send} disabled={sending} variant="floating" placeholder="Reply to your tutor…" />
                </div>
            )}
        </section>
    );
}
