import { useEffect, useRef, useState } from "react";
import MarkdownLatex from "@/components/ui/markdown-latex";
import OptionChoices from "@/components/quiz/OptionChoices";
import { formatOptionAnswer, parseQuizOptions } from "@/lib/quizOptions";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { Loader2, CheckCircle2, MessageSquare, Check } from "lucide-react";
import {
    completeNonTutorSubsection,
    fetchChapterProblems,
    markProblemUnderstood,
    sendProblemTutorMessage,
    startProblemChat,
    submitProblemWorking,
    type ChapterProblem,
    type Progression,
    type SecondaryMessage,
} from "@/lib/secondaryApi";

function ProblemTutorSheet({
    problem,
    accessToken,
    open,
    onOpenChange,
}: {
    problem: ChapterProblem;
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const [messages, setMessages] = useState<SecondaryMessage[] | null>(null);
    const [sending, setSending] = useState(false);
    const [streaming, setStreaming] = useState<string | null>(null);
    const [error, setError] = useState<{ message: string; retry?: string } | null>(null);
    const endRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open || messages !== null) return;
        startProblemChat(problem.problem_id, accessToken)
            .then((res) => setMessages(res.messages))
            .catch((err) => {
                setMessages([]);
                setError({ message: err instanceof Error ? err.message : "Couldn't start the tutor" });
            });
    }, [open, messages, problem.problem_id, accessToken]);

    useEffect(() => {
        endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, [messages, streaming]);

    const send = async (text: string) => {
        if (sending) return;
        setError(null);
        setSending(true);
        setStreaming("");
        setMessages((m) => [...(m ?? []), { role: "user", content: text }]);
        try {
            const reply = await sendProblemTutorMessage(problem.problem_id, text, accessToken, { onContent: setStreaming });
            setMessages((m) => [...(m ?? []), { role: "assistant", content: reply }]);
        } catch (err) {
            setMessages((m) => (m ?? []).slice(0, -1));
            setError({ message: err instanceof Error ? err.message : "Something went wrong", retry: text });
        } finally {
            setSending(false);
            setStreaming(null);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="h-[85dvh] max-h-[85dvh] flex flex-col p-0 rounded-t-3xl">
                <SheetHeader className="px-5 pt-5 pb-3 border-b border-border text-left">
                    <SheetTitle>Ask your tutor</SheetTitle>
                    <SheetDescription>Your tutor will guide you with questions — it won't just give you the answer.</SheetDescription>
                </SheetHeader>
                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                    {messages === null ? (
                        <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                    ) : (
                        messages.map((m, i) => <ChatBubble key={i} role={m.role} content={m.content} />)
                    )}
                    {streaming ? <ChatBubble role="assistant" content={streaming} /> : sending && <TypingIndicator />}
                    {error && (
                        <div role="alert" className="text-sm text-red-700 dark:text-red-400 text-center">
                            {error.message}{" "}
                            {error.retry && (
                                <button className="underline font-medium min-h-[44px]" onClick={() => send(error.retry!)}>Send again</button>
                            )}
                        </div>
                    )}
                    <div ref={endRef} />
                </div>
                <ChatInput onSend={send} disabled={sending || messages === null} />
            </SheetContent>
        </Sheet>
    );
}

export default function EndOfChapter({
    chapterId,
    subsectionId,
    accessToken,
    onComplete,
}: {
    chapterId: string;
    subsectionId: string;
    accessToken: string;
    onComplete: (progression: Progression | null) => void;
}) {
    const [problems, setProblems] = useState<ChapterProblem[] | null>(null);
    const [current, setCurrent] = useState(0);
    const [drafts, setDrafts] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<"submit" | "understood" | "empty" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tutorOpen, setTutorOpen] = useState(false);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        fetchChapterProblems(chapterId, accessToken)
            .then((res) => {
                setProblems(res.problems);
                const firstOpen = res.problems.findIndex((p) => !p.submitted);
                setCurrent(firstOpen === -1 ? 0 : firstOpen);
                if (res.is_complete) onComplete(null);
            })
            .catch(() => setLoadError(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chapterId, accessToken]);

    if (loadError) return <p className="text-sm text-red-700 dark:text-red-400" role="alert">Couldn't load the problems. Refresh to try again.</p>;
    if (!problems) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;

    if (problems.length === 0) {
        return (
            <div className="glass-panel rounded-3xl p-6 md:p-8 text-center space-y-4">
                <p className="text-muted-foreground">No chapter problems yet.</p>
                <button
                    onClick={async () => {
                        setBusy("empty");
                        try {
                            onComplete(await completeNonTutorSubsection(subsectionId, accessToken));
                        } catch (err) {
                            setError(err instanceof Error ? err.message : "Couldn't continue");
                        } finally {
                            setBusy(null);
                        }
                    }}
                    disabled={busy !== null}
                    className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
                >
                    {busy === "empty" && <Loader2 className="w-4 h-4 animate-spin" />} Continue
                </button>
                {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
            </div>
        );
    }

    const p = problems[current];
    const draft = drafts[p.problem_id] ?? "";
    const { stem: questionStem, options: questionOptions } = parseQuizOptions(p.question_text);
    const chosenLetter = questionOptions.find((o) => draft.startsWith(`${o.letter})`))?.letter ?? null;
    const update = (patch: Partial<ChapterProblem>) =>
        setProblems((ps) => ps && ps.map((x) => (x.problem_id === p.problem_id ? { ...x, ...patch } : x)));

    const submit = async () => {
        const text = draft.trim();
        if (!text || busy) return;
        setBusy("submit");
        setError(null);
        try {
            const res = await submitProblemWorking(p.problem_id, text, accessToken);
            update({ submitted: true, latest_working: text, answer: res.answer, working: res.working });
            if (res.chapter_complete) onComplete(res.completion);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't submit your working");
        } finally {
            setBusy(null);
        }
    };

    const understood = async () => {
        if (busy) return;
        setBusy("understood");
        setError(null);
        try {
            await markProblemUnderstood(p.problem_id, accessToken);
            update({ understood: true });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't save that");
        } finally {
            setBusy(null);
        }
    };

    const nextOpen = problems.findIndex((x, i) => i > current && !x.submitted);

    return (
        <section aria-label="End of chapter problems" className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Problems">
                {problems.map((x, i) => (
                    <button
                        key={x.problem_id}
                        role="tab"
                        aria-selected={i === current}
                        aria-label={`Problem ${i + 1}${x.submitted ? ", submitted" : ""}`}
                        onClick={() => {
                            setCurrent(i);
                            setError(null);
                        }}
                        className={`shrink-0 min-w-[48px] min-h-[48px] rounded-full font-semibold flex items-center justify-center gap-1 px-4 transition-colors ${
                            i === current ? "bg-primary text-primary-foreground" : "glass-chip text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {x.submitted && <Check className="w-3.5 h-3.5" aria-hidden />} {i + 1}
                    </button>
                ))}
            </div>

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Problem {current + 1} of {problems.length}
                    {p.marks ? ` · ${p.marks} mark${p.marks === 1 ? "" : "s"}` : ""}
                </p>
                <div className="text-[17px] leading-relaxed">
                    <MarkdownLatex content={questionStem} />
                </div>

                {/* Chapter problems are usually worked out longhand, but an
                    author can still write a multiple-choice one — those get
                    real options, and picking one starts off the working. */}
                {questionOptions.length > 0 && (
                    <OptionChoices
                        name={p.problem_id}
                        options={questionOptions}
                        selectedLetter={chosenLetter}
                        disabled={p.submitted || busy !== null}
                        onSelect={(option) => setDrafts((d) => ({ ...d, [p.problem_id]: formatOptionAnswer(option) }))}
                    />
                )}

                {!p.submitted ? (
                    <div className="space-y-3">
                        <label htmlFor={`working-${p.problem_id}`} className="text-sm font-medium">Your working</label>
                        <Textarea
                            id={`working-${p.problem_id}`}
                            value={draft}
                            onChange={(e) => setDrafts((d) => ({ ...d, [p.problem_id]: e.target.value }))}
                            placeholder="Show each step of your working…"
                            rows={8}
                            maxLength={4000}
                            className="text-[15px] font-mono leading-relaxed"
                        />
                        <p className="text-xs text-muted-foreground">Submitting shows you the full solution to compare with.</p>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={submit}
                                disabled={!draft.trim() || busy !== null}
                                className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {busy === "submit" && <Loader2 className="w-4 h-4 animate-spin" />} Submit working
                            </button>
                            {p.tutor_available && (
                                <button
                                    onClick={() => setTutorOpen(true)}
                                    className="w-full sm:w-auto min-h-[48px] px-6 rounded-full glass-chip font-medium inline-flex items-center justify-center gap-2"
                                >
                                    <MessageSquare className="w-4 h-4" /> Ask tutor →
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {p.latest_working && (
                            <div>
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Your working</p>
                                <pre className="whitespace-pre-wrap break-words font-mono text-sm rounded-2xl bg-muted/50 p-4">{p.latest_working}</pre>
                            </div>
                        )}
                        <div className="rounded-2xl border border-border p-5 space-y-3 bg-background/40">
                            {p.working && (
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Solution</p>
                                    <MarkdownLatex content={p.working} />
                                </div>
                            )}
                            {p.answer && (
                                <div>
                                    <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Answer</p>
                                    <div className="font-semibold"><MarkdownLatex content={p.answer} /></div>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <button
                                onClick={understood}
                                disabled={p.understood || busy !== null}
                                className={`w-full sm:w-auto min-h-[48px] px-6 rounded-full font-medium inline-flex items-center justify-center gap-2 ${
                                    p.understood ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" : "bg-primary text-primary-foreground"
                                }`}
                            >
                                {busy === "understood" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                {p.understood ? "Marked as understood" : "Mark as understood ✓"}
                            </button>
                            {p.tutor_available && (
                                <button
                                    onClick={() => setTutorOpen(true)}
                                    className="w-full sm:w-auto min-h-[48px] px-6 rounded-full glass-chip font-medium inline-flex items-center justify-center gap-2"
                                >
                                    <MessageSquare className="w-4 h-4" /> Ask tutor →
                                </button>
                            )}
                            {nextOpen !== -1 && (
                                <button
                                    onClick={() => setCurrent(nextOpen)}
                                    className="w-full sm:w-auto min-h-[48px] px-6 rounded-full glass-chip font-medium"
                                >
                                    Next problem
                                </button>
                            )}
                        </div>
                    </div>
                )}
                {error && <p className="text-sm text-red-700 dark:text-red-400" role="alert">{error}</p>}
            </div>

            {p.tutor_available && (
                <ProblemTutorSheet
                    key={p.problem_id}
                    problem={p}
                    accessToken={accessToken}
                    open={tutorOpen}
                    onOpenChange={setTutorOpen}
                />
            )}
        </section>
    );
}
