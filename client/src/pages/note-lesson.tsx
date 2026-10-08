import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle, RotateCcw } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { useCredits } from "@/hooks/use-credits";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import AppSidebar from "@/components/sidebar/AppSidebar";
import TechcessLoader from "@/components/brand/TechcessLoader";
import TypingIndicator from "@/components/chat/TypingIndicator";
import ChatContent from "@/components/chat/ChatContent";
import NodeStrip from "@/components/notes/lesson/NodeStrip";
import PhaseBar from "@/components/notes/lesson/PhaseBar";
import StudentMessage from "@/components/notes/lesson/StudentMessage";
import ChipRow from "@/components/notes/lesson/ChipRow";
import LessonInput from "@/components/notes/lesson/LessonInput";
import NotesDrawer from "@/components/notes/lesson/NotesDrawer";
import LessonPreparing from "@/components/notes/lesson/LessonPreparing";
import { QueuedNote } from "@/components/chat/PendingMessages";
import { useSendQueue } from "@/hooks/use-send-queue";
import { OutOfCreditsError, fetchNoteFigures, type NoteFigure } from "@/lib/api";
import { extractKeyTerms, type KeyTerm } from "@/lib/keywordHighlight";
import {
    fetchNoteBoard,
    fetchSectionState,
    openSection,
    sendSectionMessage,
    type BoardSection,
    type LessonMessage,
    type Phase,
    type Signal,
} from "@/lib/noteLessonApi";

type Completion = { next: number | null; noteComplete: boolean };

/**
 * Uni section lesson — docs/TECHCESS_NOTES_LESSON_UI_SPEC.md.
 * Route: /notes/:noteId/sections/:sectionIndex. One tutor session per section;
 * the tutor always speaks first.
 */
export default function NoteLesson() {
    const { session, user, isLoading: authLoading, signOut } = useAuth();
    useActivityHeartbeat(session?.access_token);
    const [, navigate] = useLocation();
    const params = useParams<{ noteId: string; sectionIndex: string }>();
    const noteId = params.noteId || "";
    const sectionIndex = Number(params.sectionIndex);
    const accessToken = session?.access_token || "";
    const { toast } = useToast();
    const { hasCredits, isPaid } = useCredits();
    const { promptUpgrade } = useSubscription();

    const [noteTitle, setNoteTitle] = useState("");
    const [sections, setSections] = useState<BoardSection[]>([]);
    const [sectionTitle, setSectionTitle] = useState("");
    const [nextSection, setNextSection] = useState<number | null>(null);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [messages, setMessages] = useState<LessonMessage[]>([]);
    const [phase, setPhase] = useState<Phase>(1);
    const [readOnly, setReadOnly] = useState(false);
    const [sectionCovered, setSectionCovered] = useState(false);
    const [completion, setCompletion] = useState<Completion | null>(null);
    const [keyTerms, setKeyTerms] = useState<KeyTerm[]>([]);
    const [figures, setFigures] = useState<Record<number, NoteFigure>>({});

    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [opening, setOpening] = useState(false);
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState<string | null>(null);
    const [freshIdx, setFreshIdx] = useState<number | null>(null);
    const [failed, setFailed] = useState<string | null>(null);
    const [drawerOpen, setDrawerOpen] = useState(false);

    const endRef = useRef<HTMLDivElement>(null);
    // Guards against a stale load (quick node switches) writing into the new section.
    const loadSeq = useRef(0);
    // Synchronous twin of `sending`: the queue calls send() again as soon as the
    // previous one resolves, before React has re-rendered with sending=false.
    const inFlight = useRef(false);

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    useEffect(() => {
        document.title = `${sectionTitle || "Lesson"} | TECHCESS Notes`;
    }, [sectionTitle]);

    // The note's own figures, for inline [FIGURE:n]. Best-effort.
    useEffect(() => {
        if (!noteId || !accessToken) return;
        fetchNoteFigures(noteId, accessToken)
            .then((list) => setFigures(Object.fromEntries(list.map((f) => [f.number, f]))))
            .catch(() => undefined);
    }, [noteId, accessToken]);

    const handleError = useCallback(
        (err: unknown, fallback: string) => {
            if (err instanceof OutOfCreditsError) {
                promptUpgrade();
                return;
            }
            console.error(err);
            toast({ variant: "destructive", title: fallback, description: "Please try again in a moment." });
        },
        [promptUpgrade, toast],
    );

    const load = useCallback(async () => {
        if (!accessToken || !noteId || Number.isNaN(sectionIndex)) return;
        const seq = ++loadSeq.current;
        const stale = () => seq !== loadSeq.current;

        setLoading(true);
        setLoadError(null);
        setCompletion(null);
        setFreshIdx(null);
        setFailed(null);
        setStreaming(null);
        try {
            const [board, initial] = await Promise.all([
                fetchNoteBoard(noteId, accessToken),
                fetchSectionState(noteId, sectionIndex, accessToken),
            ]);
            if (stale()) return;
            setNoteTitle(board.title);
            setSections(board.sections);

            const state = initial;
            setSectionTitle(state.title);
            setNextSection(state.next_section);
            setKeyTerms(extractKeyTerms(state.key_terms));
            setSessionId(state.session_id);
            setMessages(state.messages);
            setPhase(state.phase ?? 1);
            setReadOnly(state.read_only);
            setSectionCovered(state.section_covered);
            setLoading(false);

            if (state.needs_opening) {
                // The screen is already up; the text loop covers the few
                // seconds while the tutor (and, first time, the section's
                // plan) is prepared.
                setOpening(true);
                try {
                    const opened = await openSection(noteId, sectionIndex, accessToken);
                    if (stale()) return;
                    setSessionId(opened.session_id);
                    setMessages(opened.messages);
                    setPhase(opened.phase ?? 1);
                    if (opened.key_terms) setKeyTerms(extractKeyTerms(opened.key_terms));
                } catch (err) {
                    if (!stale()) handleError(err, "Couldn't start this lesson");
                } finally {
                    if (!stale()) setOpening(false);
                }
            }
        } catch (err) {
            if (stale()) return;
            if (err instanceof OutOfCreditsError) promptUpgrade();
            console.error("Failed to load lesson:", err);
            setLoadError("Couldn't load this lesson.");
            setLoading(false);
        }
    }, [accessToken, noteId, sectionIndex, handleError, promptUpgrade]);

    useEffect(() => {
        load();
    }, [load]);

    /** Resolves true only on a complete reply, which is what releases the next
     * queued message. A failure is reported the way it always was — the
     * `failed` banner with its own Retry — so the queue drops its copy. */
    const send = async (text: string, retry = false): Promise<boolean> => {
        if (inFlight.current || !accessToken) return false;
        inFlight.current = true;
        // Which message this reply is assessing. Taken from inside the updater
        // rather than from `messages` in this closure: a second queued message
        // is sent before React has re-rendered with the first exchange added,
        // so the closure's length would tag the previous bubble.
        const userIdx = { current: retry ? messages.length - 1 : messages.length };
        if (!retry) {
            setMessages((prev) => {
                userIdx.current = prev.length;
                return [...prev, { role: "user", content: text }];
            });
        }
        setSending(true);
        setFailed(null);
        setStreaming("");

        const applySignal = (signal: Signal) => {
            setMessages((prev) => prev.map((m, i) => (i === userIdx.current ? { ...m, signal } : m)));
            if (signal) setFreshIdx(userIdx.current);
        };

        let signalSeen = false;
        try {
            const reply = await sendSectionMessage(noteId, sectionIndex, text, accessToken, {
                onSignal: (s) => {
                    signalSeen = true;
                    applySignal(s);
                },
                onContent: (c) => setStreaming(c),
            });
            // The server's value is authoritative; it only differs from the
            // streamed one if the stream never showed it.
            if (!signalSeen) applySignal(reply.signal);
            setMessages((prev) => [
                ...prev.map((m, i) => (i === userIdx.current ? { ...m, signal: reply.signal } : m)),
                {
                    role: "assistant",
                    content: reply.content,
                    phase: reply.phase,
                    requires_chips: reply.requires_chips,
                    chip_set: reply.chip_set,
                },
            ]);
            if (reply.session_id) setSessionId(reply.session_id);
            setPhase(reply.phase);
            if (reply.section_complete) {
                setCompletion({ next: reply.next_section, noteComplete: reply.note_complete });
                // Tick this node on the strip without a refetch.
                setSections((prev) =>
                    prev.map((s) => (s.section_index === sectionIndex ? { ...s, state: "done" } : s)),
                );
            }
            return true;
        } catch (err) {
            if (err instanceof OutOfCreditsError) {
                promptUpgrade();
            } else {
                console.error("Lesson message failed:", err);
                setFailed(text);
            }
            return false;
        } finally {
            inFlight.current = false;
            setSending(false);
            setStreaming(null);
        }
    };

    // dropFailed: a failed message is already shown in the thread with the
    // `failed` banner's own Retry, so the queue must not show a second copy.
    const queue = useSendQueue(send, { dropFailed: true });

    // Follows the queue too, so a message submitted mid-reply scrolls into view.
    useEffect(() => {
        const t = setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }), 0);
        return () => clearTimeout(t);
    }, [messages, streaming, opening, completion, queue.pending]);

    // No reviewAgain handler any more — the "Review again" button is gone (it wiped the
    // conversation on a mis-tap). The backend's review flag still exists on /open if a
    // deliberate re-teach is ever wanted again.

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const position = sections.findIndex((s) => s.section_index === sectionIndex);
    const last = messages[messages.length - 1];
    // Covered, but still open for questions. `readOnly` is now only true when there is
    // no session left to continue in; a completed section keeps its composer so a
    // student with one more question doesn't have to start a review and lose the
    // conversation they wanted to ask about.
    const covered = readOnly || sectionCovered || !!completion;
    const finished = readOnly;
    // Also hidden while anything is queued: the chips answer the tutor's last
    // question, and a queued message has already answered it.
    const showChips =
        !finished && !sending && !opening && queue.pending.length === 0 &&
        last?.role === "assistant" && last.requires_chips && !!last.chip_set;
    const outOfCredits = !hasCredits && !isPaid;

    const shell = (body: React.ReactNode) => (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
            <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />
            {body}
        </div>
    );

    if (authLoading || (loading && !loadError)) {
        return shell(
            <div className="flex-1 relative">
                <TechcessLoader label="Loading your lesson" />
            </div>,
        );
    }

    if (loadError) {
        return shell(
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center gap-4">
                <p className="text-muted-foreground">{loadError}</p>
                <div className="flex gap-3">
                    <button onClick={load} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold">
                        Retry
                    </button>
                    <button onClick={() => navigate(`/notes/${noteId}`)} className="bg-muted px-6 py-2.5 rounded-full text-sm font-semibold">
                        Back to board
                    </button>
                </div>
            </div>,
        );
    }

    return shell(
        <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {/* §3.1 top bar · §3.2 node strip · §3.3 phase bar */}
            <header className="flex-shrink-0 border-b border-border bg-background/60 backdrop-blur-xl">
                <div className="max-w-3xl mx-auto px-4 pt-3 pb-3 space-y-3">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigate(`/notes/${noteId}`)}
                            aria-label="Back to board"
                            className="w-9 h-9 -ml-2 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
                        >
                            <ArrowLeft className="w-4 h-4" />
                        </button>
                        <p className="flex-1 min-w-0 truncate text-[13px] font-semibold">{noteTitle}</p>
                        <button
                            onClick={() => setDrawerOpen(true)}
                            className="shrink-0 h-8 px-3 rounded-full border border-border text-xs font-medium inline-flex items-center gap-1.5 hover:border-primary/50"
                        >
                            <BookOpen className="w-3.5 h-3.5" /> Notes
                        </button>
                    </div>
                    <h1 className="text-[15px] font-semibold leading-snug">
                        <span className="text-muted-foreground font-medium">Section {position + 1} — </span>
                        {sectionTitle}
                    </h1>
                    <NodeStrip
                        sections={sections}
                        activeIndex={sectionIndex}
                        onSelect={(idx) => navigate(`/notes/${noteId}/sections/${idx}`)}
                    />
                    {!readOnly && <PhaseBar phase={phase} />}
                </div>
            </header>

            {/* §3.4 conversation */}
            <main className="flex-1 overflow-y-auto">
                <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">
                    {messages.map((m, i) =>
                        m.role === "assistant" ? (
                            <TutorMessage key={i} content={m.content} sessionId={sessionId} keyTerms={keyTerms} figures={figures} />
                        ) : (
                            <StudentMessage
                                key={i}
                                content={m.content}
                                signal={m.signal}
                                fresh={i === freshIdx}
                                pending={sending && i === messages.length - 1}
                            />
                        ),
                    )}

                    {showChips && last.chip_set && <ChipRow chipSet={last.chip_set} onPick={queue.enqueue} disabled={outOfCredits} />}

                    {/* Queued messages — the notes lesson draws the student's
                        own turns with StudentMessage, so it renders its own. */}
                    {queue.pending.map((m) => (
                        <div key={m.id} className="opacity-70">
                            <StudentMessage content={m.content} signal={undefined} />
                            <QueuedNote item={m} onRetry={queue.retry} onDismiss={queue.dismiss} />
                        </div>
                    ))}

                    {streaming ? <TutorMessage content={streaming} figures={figures} /> : null}
                    {/* Only ever while there is genuinely nothing to show. The rotating
                        "Reading this section… Finding the core idea…" phrases describe
                        work that is about to happen, so on a section the student is
                        coming back to — where the conversation is already on screen —
                        they read as the lesson restarting from scratch. */}
                    {opening && messages.length === 0 && <LessonPreparing review={readOnly || sectionCovered} />}
                    {sending && !streaming && (
                        <div>
                            <TutorLabel />
                            <TypingIndicator />
                        </div>
                    )}

                    {failed && !sending && (
                        <div className="flex justify-center">
                            <div className="flex items-center gap-3 text-sm text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2">
                                <span>Something went wrong getting a response.</span>
                                <button onClick={() => send(failed, true)} className="inline-flex items-center gap-1 font-semibold">
                                    <RotateCcw className="w-3.5 h-3.5" /> Retry
                                </button>
                            </div>
                        </div>
                    )}

                    <div ref={endRef} />
                </div>
            </main>

            {/* §3.6 input — or, once the section is done, where to go next */}
            <footer className="flex-shrink-0 bg-background/80 backdrop-blur-xl border-t border-border">
                <div className="max-w-3xl mx-auto px-4 pt-2.5 pb-3">
                    {covered && (
                        <SectionDone
                            justCompleted={!!completion}
                            noteComplete={completion?.noteComplete ?? false}
                            next={completion ? completion.next : nextSection}
                            onNext={(idx) => navigate(`/notes/${noteId}/sections/${idx}`)}
                            onBoard={() => navigate(`/notes/${noteId}`)}
                        />
                    )}
                    {/* Shown alongside SectionDone once covered: where to go next AND
                        the option to keep asking about what was just learnt. */}
                    {!finished && (
                        <>
                            {outOfCredits && (
                                <button
                                    onClick={promptUpgrade}
                                    className="w-full mb-2 text-center text-sm text-red-700 dark:text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-2"
                                >
                                    You've run out of credits. Upgrade to Pro →
                                </button>
                            )}
                            {covered && (
                                <p className="text-center text-xs text-muted-foreground mb-1.5">
                                    Section covered — ask anything else about it below.
                                </p>
                            )}
                            {/* A streaming reply no longer locks the box — the
                                message is queued and sent when it completes. */}
                            <LessonInput onSend={queue.enqueue} disabled={opening || outOfCredits} />
                        </>
                    )}
                </div>
            </footer>

            <NotesDrawer
                open={drawerOpen}
                onOpenChange={setDrawerOpen}
                noteId={noteId}
                accessToken={accessToken}
                currentSection={sectionIndex}
            />
        </div>,
    );
}

function TutorLabel() {
    return <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground mb-1.5">TECHCESS</p>;
}

/** Spec §3.4 — tutor turn: label above, card-toned bubble. Key terms only on
 *  committed messages (Feature 05 highlights after streaming, never during). */
function TutorMessage({
    content,
    sessionId,
    keyTerms,
    figures,
}: {
    content: string;
    sessionId?: string | null;
    keyTerms?: KeyTerm[];
    figures?: Record<number, NoteFigure>;
}) {
    return (
        <div className="w-full">
            <TutorLabel />
            <div
                className="min-w-0 bg-card border border-border px-4 py-3 text-[13px] leading-[1.6] text-foreground"
                style={{ borderRadius: "4px 12px 12px 12px" }}
            >
                <ChatContent content={content} sessionId={sessionId ?? undefined} keyTerms={keyTerms} figures={figures} />
            </div>
        </div>
    );
}

/**
 * Shown once a section is covered, above the composer — which stays available, so the
 * student can keep asking about what they just learnt.
 *
 * There is deliberately no "Review again" here (David, 2026-10-05): it started a fresh
 * session and wiped the conversation, so a single mis-tap destroyed the lesson the
 * student had come back to re-read.
 */
function SectionDone({
    justCompleted,
    noteComplete,
    next,
    onNext,
    onBoard,
}: {
    justCompleted: boolean;
    noteComplete: boolean;
    next: number | null;
    onNext: (idx: number) => void;
    onBoard: () => void;
}) {
    return (
        <div className="space-y-2.5">
            <p className="flex items-center gap-2 text-sm font-medium">
                <CheckCircle className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
                {noteComplete
                    ? "That's every section of this note done."
                    : justCompleted
                      ? "Section complete."
                      : "You've completed this section."}
            </p>
            <div className="flex flex-wrap gap-2">
                {next !== null && (
                    <button
                        onClick={() => onNext(next)}
                        className="min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-sm font-semibold inline-flex items-center gap-1.5"
                    >
                        Next section <ArrowRight className="w-4 h-4" />
                    </button>
                )}
                <button onClick={onBoard} className="min-h-[44px] px-5 rounded-full border border-border text-sm font-medium">
                    Back to board
                </button>
            </div>
        </div>
    );
}
