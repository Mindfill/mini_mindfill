import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import SecondaryShell, { AccessErrorState, PageLoader } from "@/components/secondary/SecondaryShell";
import DiagnosticPreparing, { PRACTICE_PHRASES } from "@/components/secondary/DiagnosticPreparing";
import PracticeTutorSheet from "@/components/secondary/PracticeTutorSheet";
import MarkdownLatex from "@/components/ui/markdown-latex";
import OptionChoices from "@/components/quiz/OptionChoices";
import CorrectAnswerBurst from "@/components/quiz/CorrectAnswerBurst";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import {
    ArrowRight,
    CheckCircle2,
    ChevronLeft,
    Clock,
    Loader2,
    MessageSquare,
    RotateCcw,
    XCircle,
} from "lucide-react";
import {
    answerPracticeQuestion,
    createPracticeQuiz,
    finishPracticeQuiz,
    PRACTICE_DIFFICULTY_LABEL,
    SecondaryApiError,
    type PracticeLength,
    type PracticeQuestion,
    type PracticeQuiz,
} from "@/lib/secondaryApi";
import { invalidateSecondaryProgress, secondaryKeys, stampReceived, usePracticeQuiz } from "@/lib/secondaryQueries";

/**
 * /secondary/practice/:quizId — one practice quiz, start to review.
 *
 * Untimed: each answer is checked as it's given — right/wrong, the worked
 * solution, and "Ask tutor". Timed: exam-style, answers are saved but nothing
 * is revealed until the quiz is finished (or the clock runs out).
 */
export default function PracticeQuizPage() {
    const { quizId } = useParams<{ quizId: string }>();
    return (
        <SecondaryShell>
            {({ accessToken }) => <PracticeQuizLoader quizId={quizId} accessToken={accessToken} />}
        </SecondaryShell>
    );
}

function PracticeQuizLoader({ quizId, accessToken }: { quizId: string; accessToken: string }) {
    const { data, error, refetch } = usePracticeQuiz(quizId, accessToken);
    if (error && !data) return <AccessErrorState error={error} onRetry={() => refetch()} />;
    if (!data) return <PageLoader />;
    // Keyed so "Practice again" (a new quiz id) starts from a clean slate.
    return <PracticeQuizRunner key={data.id} initial={data} accessToken={accessToken} />;
}

function nearestLength(count: number): PracticeLength {
    return count > 20 ? 30 : count > 10 ? 20 : 10;
}

function PracticeQuizRunner({ initial, accessToken }: { initial: PracticeQuiz; accessToken: string }) {
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const [quiz, setQuiz] = useState<PracticeQuiz>(initial);
    const [current, setCurrent] = useState(() => {
        const firstOpen = initial.questions.findIndex((q) => !q.answer_state);
        return firstOpen === -1 ? 0 : firstOpen;
    });
    const [chosen, setChosen] = useState<Record<string, string>>({});
    const [busy, setBusy] = useState<"answer" | "finish" | "again" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [burstKey, setBurstKey] = useState<string | null>(null);
    const [tutorFor, setTutorFor] = useState<PracticeQuestion | null>(null);
    const [tutorOpen, setTutorOpen] = useState(false);
    const [confirmFinish, setConfirmFinish] = useState(false);

    const finished = quiz.status === "finished";
    const questions = quiz.questions;
    const question = questions[current];
    const answeredCount = questions.filter((q) => q.answer_state?.given).length;

    useEffect(() => {
        document.title = "Practice | TECHCESS";
    }, []);

    // The cache mirrors what's on screen, so leaving and coming back (or Back
    // from the tutor) shows the answers already given, not the quiz as it was
    // first loaded.
    useEffect(() => {
        queryClient.setQueryData(secondaryKeys.practiceQuiz(quiz.id), quiz);
    }, [quiz, queryClient]);

    const applyFinished = useCallback(
        (next: PracticeQuiz) => {
            setQuiz(stampReceived(next));
            // The streak, the dashboard's practice card and the history list all
            // just changed.
            void invalidateSecondaryProgress(queryClient);
        },
        [queryClient],
    );

    const finish = useCallback(async () => {
        setBusy("finish");
        setError(null);
        try {
            applyFinished(await finishPracticeQuiz(quiz.id, accessToken));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't mark your quiz");
        } finally {
            setBusy(null);
            setConfirmFinish(false);
        }
    }, [quiz.id, accessToken, applyFinished]);

    // ── Timed mode countdown ───────────────────────────────────────────────
    // The server's start time, shifted onto this device's clock by how far the
    // two clocks disagreed when the quiz arrived — so a wrong device clock can't
    // shorten or stretch the quiz, and a remount from cache doesn't reset it.
    const deadline = useMemo(() => {
        if (!initial.timed || !initial.time_limit_seconds) return null;
        const skew = Date.parse(initial.server_now) - (initial.received_at ?? Date.now());
        return Date.parse(initial.started_at) - skew + initial.time_limit_seconds * 1000;
    }, [initial]);
    const [now, setNow] = useState(() => Date.now());
    const autoFinished = useRef(false);

    useEffect(() => {
        if (!deadline || finished) return;
        const t = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(t);
    }, [deadline, finished]);

    const secondsLeft = deadline ? Math.max(0, Math.round((deadline - now) / 1000)) : null;

    useEffect(() => {
        if (secondsLeft === 0 && !finished && !autoFinished.current) {
            autoFinished.current = true;
            void finish();
        }
    }, [secondsLeft, finished, finish]);

    // ── Answering ──────────────────────────────────────────────────────────
    const submitAnswer = async () => {
        if (!question) return;
        const letter = chosen[question.id];
        if (!letter) return;
        setBusy("answer");
        setError(null);
        try {
            const res = await answerPracticeQuestion(quiz.id, question.id, letter, accessToken);
            setQuiz((prev) => ({
                ...prev,
                questions: prev.questions.map((q) =>
                    q.id === question.id
                        ? {
                              ...q,
                              answer_state: prev.timed
                                  ? { given: letter }
                                  : {
                                        given: res.given ?? letter,
                                        correct: res.correct,
                                        answer: res.answer,
                                        explanation: res.explanation,
                                    },
                          }
                        : q,
                ),
            }));
            if (!quiz.timed && res.correct) setBurstKey(`${question.id}`);
            if (quiz.timed) {
                // Exam style: straight on to the next unanswered question.
                const next = questions.findIndex((q, i) => i > current && !q.answer_state?.given && q.id !== question.id);
                const wrap = questions.findIndex((q) => !q.answer_state?.given && q.id !== question.id);
                if (next !== -1) setCurrent(next);
                else if (wrap !== -1) setCurrent(wrap);
            }
        } catch (err) {
            const e = err instanceof SecondaryApiError ? err : null;
            if (e?.reason === "time_up") {
                void finish();
                return;
            }
            if (e?.reason === "quiz_finished") {
                window.location.reload();
                return;
            }
            setError(err instanceof Error ? err.message : "Couldn't save your answer");
        } finally {
            setBusy(null);
        }
    };

    const practiceAgain = async () => {
        setBusy("again");
        setError(null);
        try {
            const next = await createPracticeQuiz(
                {
                    subject_id: quiz.subject_id,
                    chapter_ids: quiz.chapter_ids,
                    section_ids: quiz.section_ids,
                    question_count: nearestLength(quiz.question_count + quiz.short_by),
                    difficulty: quiz.difficulty,
                    timed: quiz.timed,
                    // Same clock as last time, whatever the student set it to.
                    ...(quiz.timed && quiz.time_limit_seconds
                        ? { time_limit_minutes: Math.max(1, Math.round(quiz.time_limit_seconds / 60)) }
                        : {}),
                },
                accessToken,
            );
            queryClient.setQueryData(secondaryKeys.practiceQuiz(next.id), stampReceived(next));
            navigate(`/secondary/practice/${next.id}`);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't prepare your quiz");
            setBusy(null);
        }
    };

    const openTutor = (q: PracticeQuestion) => {
        setTutorFor(q);
        setTutorOpen(true);
    };

    const backToSetup = () => navigate("/secondary/practice");

    if (busy === "again") {
        return (
            <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
                <Header quiz={quiz} onBack={backToSetup} />
                <DiagnosticPreparing phrases={PRACTICE_PHRASES} />
            </main>
        );
    }

    if (finished && quiz.result) {
        return (
            <>
                <Results
                    quiz={quiz}
                    onBack={backToSetup}
                    onAgain={practiceAgain}
                    onAskTutor={openTutor}
                    error={error}
                />
                {tutorFor && (
                    <PracticeTutorSheet
                        quizId={quiz.id}
                        question={tutorFor}
                        accessToken={accessToken}
                        open={tutorOpen}
                        onOpenChange={setTutorOpen}
                    />
                )}
            </>
        );
    }

    if (!question) return <PageLoader />;

    const state = question.answer_state;
    const locked = !!state?.given;
    const selected = (state?.given ?? chosen[question.id] ?? null)?.toUpperCase() ?? null;
    const revealed = !quiz.timed && state?.answer;
    const nextOpen = questions.findIndex((q, i) => i > current && !q.answer_state?.given);
    const anyOpen = questions.findIndex((q) => !q.answer_state?.given);
    const allAnswered = anyOpen === -1;
    const lowTime = secondsLeft !== null && secondsLeft <= 60;

    return (
        <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
            <Header quiz={quiz} onBack={backToSetup} />

            {quiz.short_by > 0 && current === 0 && answeredCount === 0 && (
                <p className="text-sm text-amber-700 dark:text-amber-400" role="status">
                    We could only put together {questions.length} questions this time — new ones are being added as more
                    students practice.
                </p>
            )}

            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                        <ProgressBar
                            value={(answeredCount / questions.length) * 100}
                            complete={allAnswered}
                            label={`${answeredCount} of ${questions.length} answered`}
                        />
                    </div>
                    {secondsLeft !== null && (
                        <span
                            className={`shrink-0 inline-flex items-center gap-1.5 text-sm font-mono font-semibold tabular-nums px-3 min-h-[36px] rounded-full glass-chip ${
                                lowTime ? "text-red-700 dark:text-red-400" : ""
                            }`}
                            role="timer"
                            aria-label={`${Math.floor(secondsLeft / 60)} minutes ${secondsLeft % 60} seconds left`}
                        >
                            <Clock className="w-4 h-4" aria-hidden />
                            {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
                        </span>
                    )}
                </div>
                <QuestionPills questions={questions} current={current} timed={quiz.timed} onSelect={setCurrent} />
            </div>

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-5 relative overflow-hidden">
                <CorrectAnswerBurst triggerKey={state?.correct && burstKey === question.id ? burstKey : null} />
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Question {current + 1} of {questions.length} · {PRACTICE_DIFFICULTY_LABEL[question.difficulty]}
                </p>
                <p className="text-xs text-muted-foreground -mt-3 truncate">
                    {question.chapter_title}
                    {question.section_label ? ` · ${question.section_label}` : ""}
                </p>
                <div className="text-[17px] leading-relaxed min-w-0">
                    <MarkdownLatex content={question.question_text} />
                </div>
                <OptionChoices
                    name={question.id}
                    options={question.options.map((o) => ({ letter: o.letter.toUpperCase(), text: o.text }))}
                    selectedLetter={selected}
                    correctLetter={revealed ? state!.answer!.toUpperCase() : null}
                    onSelect={(option) => setChosen((prev) => ({ ...prev, [question.id]: option.letter.toLowerCase() }))}
                    disabled={locked || busy !== null}
                />

                {revealed && (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`rounded-2xl p-4 flex gap-3 ${
                            state!.correct
                                ? "bg-emerald-500/10 border border-emerald-500/30"
                                : "bg-red-500/10 border border-red-500/30"
                        }`}
                    >
                        {state!.correct ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-700 dark:text-red-400 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-2 min-w-0 flex-1">
                            <p className="font-semibold">{state!.correct ? "Correct" : "Not quite"}</p>
                            {state!.explanation && (
                                <MarkdownLatex content={state!.explanation} className="text-sm text-muted-foreground [&_p]:mb-1" />
                            )}
                            <button
                                onClick={() => openTutor(question)}
                                className="min-h-[44px] px-4 rounded-full glass-chip text-sm font-medium inline-flex items-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" /> Ask tutor
                            </button>
                        </div>
                    </div>
                )}

                {quiz.timed && locked && (
                    <p className="text-sm text-muted-foreground" role="status">
                        Answer saved. You'll see how you did at the end.
                    </p>
                )}
            </div>

            {error && (
                <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                    {error}
                </p>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Finishing early is a real choice — unanswered questions count
                    as wrong — so it asks once before doing it. */}
                <button
                    onClick={() => (allAnswered || confirmFinish ? finish() : setConfirmFinish(true))}
                    disabled={busy !== null || answeredCount === 0}
                    className={`min-h-[44px] px-4 rounded-full text-sm font-medium disabled:opacity-40 ${
                        confirmFinish ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                    {busy === "finish" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : confirmFinish ? (
                        `Finish with ${questions.length - answeredCount} unanswered?`
                    ) : (
                        "Finish now"
                    )}
                </button>

                {!locked ? (
                    <button
                        onClick={submitAnswer}
                        disabled={!chosen[question.id] || busy !== null}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        {busy === "answer" && <Loader2 className="w-4 h-4 animate-spin" />}
                        {quiz.timed ? "Save & next" : "Check"}
                    </button>
                ) : allAnswered ? (
                    <button
                        onClick={finish}
                        disabled={busy !== null}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        {busy === "finish" && <Loader2 className="w-4 h-4 animate-spin" />}
                        See results <ArrowRight className="w-4 h-4" />
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrent(nextOpen !== -1 ? nextOpen : anyOpen)}
                        disabled={busy !== null}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        Next <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>

            {tutorFor && (
                <PracticeTutorSheet
                    quizId={quiz.id}
                    question={tutorFor}
                    accessToken={accessToken}
                    open={tutorOpen}
                    onOpenChange={setTutorOpen}
                />
            )}
        </main>
    );
}

function Header({ quiz, onBack }: { quiz: PracticeQuiz; onBack: () => void }) {
    const titles = quiz.chapter_titles;
    return (
        <div className="space-y-3">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] -ml-1"
            >
                <ChevronLeft className="w-4 h-4" /> Practice
            </button>
            <div className="min-w-0">
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    {PRACTICE_DIFFICULTY_LABEL[quiz.difficulty]} · {quiz.timed ? "Timed" : "Untimed"}
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1 line-clamp-2">
                    {titles.length === 1 ? titles[0] : titles.length > 1 ? `${titles[0]} + ${titles.length - 1} more` : "Practice quiz"}
                </h1>
            </div>
        </div>
    );
}

/** Question numbers. Untimed shows ✓/✗ as you go; timed only shows answered. */
function QuestionPills({
    questions,
    current,
    timed,
    onSelect,
}: {
    questions: PracticeQuestion[];
    current: number;
    timed: boolean;
    onSelect: (i: number) => void;
}) {
    return (
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Questions">
            {questions.map((q, i) => {
                const s = q.answer_state;
                let tone = "border-border text-muted-foreground";
                let symbol = "";
                let label = "not answered";
                if (s?.given && (timed || s.correct === undefined)) {
                    tone = "border-primary/50 bg-primary/10 text-foreground";
                    symbol = "•";
                    label = "answered";
                } else if (s?.given && s.correct) {
                    tone = "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                    symbol = "✓";
                    label = "correct";
                } else if (s?.given) {
                    tone = "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400";
                    symbol = "✗";
                    label = "wrong";
                }
                return (
                    <button
                        key={q.id}
                        role="tab"
                        aria-selected={i === current}
                        aria-label={`Question ${i + 1}: ${label}`}
                        onClick={() => onSelect(i)}
                        className={`min-w-[44px] min-h-[44px] rounded-full border text-sm font-semibold flex items-center justify-center gap-1 px-3 ${tone} ${
                            i === current ? "ring-2 ring-primary" : ""
                        }`}
                    >
                        {symbol && <span aria-hidden>{symbol}</span>} {i + 1}
                    </button>
                );
            })}
        </div>
    );
}

function Results({
    quiz,
    onBack,
    onAgain,
    onAskTutor,
    error,
}: {
    quiz: PracticeQuiz;
    onBack: () => void;
    onAgain: () => void;
    onAskTutor: (q: PracticeQuestion) => void;
    error: string | null;
}) {
    const result = quiz.result!;
    const pct = result.accuracy_percent;
    const tone =
        pct >= 70
            ? "text-emerald-700 dark:text-emerald-400"
            : pct >= 50
              ? "text-amber-700 dark:text-amber-400"
              : "text-red-700 dark:text-red-400";
    const [onlyWrong, setOnlyWrong] = useState(false);
    const reviewed = onlyWrong ? quiz.questions.filter((q) => !q.answer_state?.correct) : quiz.questions;

    return (
        <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
            <Header quiz={quiz} onBack={onBack} />

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="text-4xl font-semibold">
                        {result.correct_count}/{result.question_count}
                    </span>
                    <span className={`text-lg font-medium ${tone}`}>{pct}%</span>
                </div>
                <p className="text-sm text-muted-foreground">
                    {result.answered_count < result.question_count
                        ? `${result.question_count - result.answered_count} left unanswered — those count as wrong.`
                        : "Every question answered."}
                    {result.finished_late && (
                        <span className="text-amber-700 dark:text-amber-400"> Finished after the time ran out.</span>
                    )}
                </p>

                {result.by_chapter.length > 1 && (
                    <div className="space-y-3 pt-2 border-t border-border">
                        {result.by_chapter.map((c) => (
                            <ProgressBar
                                key={c.chapter_id}
                                value={c.total ? (c.correct / c.total) * 100 : 0}
                                complete={c.total > 0 && c.correct === c.total}
                                label={`${c.chapter_title} · ${c.correct}/${c.total}`}
                            />
                        ))}
                    </div>
                )}

                <div className="flex flex-wrap gap-3 pt-2">
                    <button
                        onClick={onAgain}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2"
                    >
                        <RotateCcw className="w-4 h-4" /> Practice again
                    </button>
                    <button
                        onClick={onBack}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-full glass-chip font-medium"
                    >
                        New quiz
                    </button>
                </div>
                {error && (
                    <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                        {error}
                    </p>
                )}
            </div>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Review</h2>
                    {result.correct_count < result.question_count && (
                        <button
                            onClick={() => setOnlyWrong((v) => !v)}
                            className="min-h-[40px] px-4 rounded-full glass-chip text-sm font-medium"
                            aria-pressed={onlyWrong}
                        >
                            {onlyWrong ? "Show all" : "Only wrong ones"}
                        </button>
                    )}
                </div>
                {reviewed.map((q) => {
                    const s = q.answer_state;
                    const i = quiz.questions.indexOf(q);
                    return (
                        <div key={q.id} className="glass-panel rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-2 min-w-0">
                                <span
                                    className={`text-xs font-semibold mt-0.5 shrink-0 ${
                                        s?.correct ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400"
                                    }`}
                                >
                                    {i + 1}. {s?.correct ? "✓" : s?.given ? "✗" : "—"}
                                </span>
                                <MarkdownLatex content={q.question_text} className="text-sm flex-1 min-w-0 [&_p]:mb-0" />
                            </div>
                            <OptionChoices
                                name={`review-${q.id}`}
                                options={q.options.map((o) => ({ letter: o.letter.toUpperCase(), text: o.text }))}
                                selectedLetter={s?.given ? s.given.toUpperCase() : null}
                                correctLetter={s?.answer ? s.answer.toUpperCase() : null}
                                onSelect={() => {}}
                                disabled
                            />
                            {s?.explanation && (
                                <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                                    <MarkdownLatex content={s.explanation} className="text-inherit [&_p]:mb-0" />
                                </div>
                            )}
                            <button
                                onClick={() => onAskTutor(q)}
                                className="min-h-[44px] px-4 rounded-full glass-chip text-sm font-medium inline-flex items-center gap-2"
                            >
                                <MessageSquare className="w-4 h-4" /> Ask tutor
                            </button>
                        </div>
                    );
                })}
            </section>
        </main>
    );
}
