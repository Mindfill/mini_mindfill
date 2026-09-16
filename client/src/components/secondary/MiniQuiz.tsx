import { useEffect, useMemo, useState } from "react";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { Textarea } from "@/components/ui/textarea";
import CorrectAnswerBurst from "@/components/quiz/CorrectAnswerBurst";
import OptionChoices from "@/components/quiz/OptionChoices";
import { formatOptionAnswer, parseQuizOptions } from "@/lib/quizOptions";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import { Loader2, CheckCircle2, XCircle, AlertCircle, Eye, RotateCcw, ArrowRight } from "lucide-react";
import {
    completeNonTutorSubsection,
    fetchQuiz,
    revealQuizSolution,
    submitQuizAnswer,
    type NextDestination,
    type Progression,
    type QuizQuestionState,
} from "@/lib/secondaryApi";

type Indicator = { symbol: string; label: string; className: string };

function indicatorFor(q: QuizQuestionState): Indicator {
    if (q.passed) return { symbol: "✓", label: "Passed", className: "text-emerald-600 dark:text-emerald-400 border-emerald-500/50 bg-emerald-500/10" };
    if (q.seen_solution) return { symbol: "●", label: "Saw solution", className: "text-sky-600 dark:text-sky-400 border-sky-500/50 bg-sky-500/10" };
    if (q.last_result === "partial" || q.last_result === "fail")
        return { symbol: "◐", label: q.last_result === "partial" ? "Partly right" : "Not yet", className: "text-amber-600 dark:text-amber-400 border-amber-500/50 bg-amber-500/10" };
    return { symbol: "○", label: "Not attempted", className: "text-muted-foreground border-border" };
}

const isDone = (q: QuizQuestionState) => q.passed || q.seen_solution;

export default function MiniQuiz({
    subsectionId,
    accessToken,
    onComplete,
}: {
    subsectionId: string;
    accessToken: string;
    /** Called once every question is resolved (or the quiz is already complete). */
    onComplete: (progression: Progression | null, next: NextDestination | null) => void;
}) {
    const [questions, setQuestions] = useState<QuizQuestionState[] | null>(null);
    const [next, setNext] = useState<NextDestination | null>(null);
    const [current, setCurrent] = useState(0);
    const [answer, setAnswer] = useState("");
    const [chosenLetter, setChosenLetter] = useState<string | null>(null);
    const [busy, setBusy] = useState<"submit" | "reveal" | "empty" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [burstKey, setBurstKey] = useState<number | null>(null);
    const [loadError, setLoadError] = useState(false);

    useEffect(() => {
        fetchQuiz(subsectionId, accessToken)
            .then((res) => {
                setQuestions(res.questions);
                setNext(res.next);
                const firstOpen = res.questions.findIndex((q) => !isDone(q));
                setCurrent(firstOpen === -1 ? 0 : firstOpen);
                if (res.is_complete) onComplete(null, res.next);
            })
            .catch(() => setLoadError(true));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [subsectionId, accessToken]);

    const doneCount = useMemo(() => (questions ?? []).filter(isDone).length, [questions]);

    if (loadError) return <p className="text-sm text-red-600 dark:text-red-400" role="alert">Couldn't load the quiz. Refresh to try again.</p>;
    if (!questions) return <Loader2 className="w-5 h-5 animate-spin text-muted-foreground mx-auto" />;

    // An authored quiz with no active questions yet must not block the student.
    if (questions.length === 0) {
        return (
            <div className="glass-panel rounded-3xl p-8 text-center space-y-4">
                <p className="text-muted-foreground">There are no questions here yet.</p>
                <button
                    onClick={async () => {
                        setBusy("empty");
                        try {
                            onComplete(await completeNonTutorSubsection(subsectionId, accessToken), next);
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
                {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            </div>
        );
    }

    const q = questions[current];
    const update = (patch: Partial<QuizQuestionState>) =>
        setQuestions((qs) => qs && qs.map((x, i) => (i === current ? { ...x, ...patch } : x)));

    const submit = async () => {
        const text = answer.trim();
        if (!text || busy) return;
        setBusy("submit");
        setError(null);
        try {
            const res = await submitQuizAnswer(q.problem_id, text, accessToken);
            update({
                attempts: q.attempts + 1,
                last_result: res.result,
                last_feedback: res.feedback,
                passed: q.passed || res.result === "pass",
                ...(res.answer !== undefined ? { answer: res.answer, working: res.working } : {}),
            });
            if (res.result === "pass") setBurstKey(Date.now());
            if (res.quiz_complete) onComplete(res.completion, res.completion?.next ?? next);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't submit your answer");
        } finally {
            setBusy(null);
        }
    };

    const reveal = async () => {
        if (busy) return;
        setBusy("reveal");
        setError(null);
        try {
            const res = await revealQuizSolution(q.problem_id, accessToken);
            update({ seen_solution: true, answer: res.answer, working: res.working });
            if (res.quiz_complete) onComplete(res.completion, res.completion?.next ?? next);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't show the solution");
        } finally {
            setBusy(null);
        }
    };

    const goTo = (i: number) => {
        setCurrent(i);
        setAnswer("");
        setChosenLetter(null);
        setError(null);
    };

    // Options authored inline in the question text ("(a) … (b) …") become real
    // choices; anything else stays a typed answer.
    const { stem, options } = parseQuizOptions(q.question_text);
    const isMultipleChoice = options.length > 0;
    // Once the solution is known, highlight which option it was. The answer
    // key is usually just the letter ("b").
    const solutionLetter = (() => {
        const key = (q.answer ?? "").trim();
        const match = key.match(/^\(?([a-hA-H])\)?[).:]?\s*$/);
        return match ? match[1].toUpperCase() : null;
    })();

    const nextOpen = questions.findIndex((x, i) => i > current && !isDone(x));
    const anyOpen = questions.findIndex((x) => !isDone(x));
    const resultTone = q.last_result === "pass" ? "pass" : q.last_result;
    const showResult = q.attempts > 0 && q.last_result !== null;

    return (
        <section aria-label="Mini quiz" className="space-y-6">
            <div className="space-y-3">
                <ProgressBar value={(doneCount / questions.length) * 100} complete={doneCount === questions.length} label={`${doneCount} of ${questions.length} done`} />
                <div className="flex flex-wrap gap-2" role="tablist" aria-label="Questions">
                    {questions.map((x, i) => {
                        const ind = indicatorFor(x);
                        return (
                            <button
                                key={x.problem_id}
                                role="tab"
                                aria-selected={i === current}
                                aria-label={`Question ${i + 1}: ${ind.label}`}
                                onClick={() => goTo(i)}
                                className={`min-w-[44px] min-h-[44px] rounded-full border text-sm font-semibold flex items-center justify-center gap-1 px-3 ${ind.className} ${i === current ? "ring-2 ring-primary" : ""}`}
                            >
                                <span aria-hidden>{ind.symbol}</span> {i + 1}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-5 relative overflow-hidden">
                <CorrectAnswerBurst triggerKey={q.last_result === "pass" ? burstKey : null} />
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Question {current + 1} of {questions.length}
                    {q.marks ? ` · ${q.marks} mark${q.marks === 1 ? "" : "s"}` : ""}
                </p>
                <div className="text-[17px] leading-relaxed">
                    <MarkdownLatex content={stem} />
                </div>

                {isMultipleChoice && (
                    <OptionChoices
                        name={q.problem_id}
                        options={options}
                        selectedLetter={chosenLetter}
                        disabled={isDone(q) || busy !== null}
                        correctLetter={isDone(q) ? solutionLetter : null}
                        onSelect={(option) => {
                            setChosenLetter(option.letter);
                            setAnswer(formatOptionAnswer(option));
                        }}
                    />
                )}

                {!isDone(q) && (
                    <div className="space-y-3">
                        {!isMultipleChoice && (
                            <>
                                <label htmlFor={`answer-${q.problem_id}`} className="sr-only">Your answer</label>
                                <Textarea
                                    id={`answer-${q.problem_id}`}
                                    value={answer}
                                    onChange={(e) => setAnswer(e.target.value)}
                                    placeholder="Type your answer…"
                                    rows={3}
                                    maxLength={2000}
                                    className="text-[15px]"
                                />
                            </>
                        )}
                        <button
                            onClick={submit}
                            disabled={!answer.trim() || busy !== null}
                            className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {busy === "submit" && <Loader2 className="w-4 h-4 animate-spin" />}
                            {q.attempts > 0 ? "Submit again" : "Submit"}
                        </button>
                    </div>
                )}

                {showResult && (
                    <div
                        role="status"
                        aria-live="polite"
                        className={`rounded-2xl p-4 flex gap-3 ${
                            resultTone === "pass"
                                ? "bg-emerald-500/10 border border-emerald-500/30"
                                : resultTone === "partial"
                                    ? "bg-amber-500/10 border border-amber-500/30"
                                    : "bg-red-500/10 border border-red-500/30"
                        }`}
                    >
                        {resultTone === "pass" ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                        ) : resultTone === "partial" ? (
                            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-1">
                            <p className="font-semibold">
                                {resultTone === "pass" ? "Correct" : resultTone === "partial" ? "Almost there" : "Not quite"}
                            </p>
                            {q.last_feedback && <p className="text-sm text-muted-foreground">{q.last_feedback}</p>}
                        </div>
                    </div>
                )}

                {showResult && !isDone(q) && (
                    <div className="flex flex-wrap gap-3">
                        <button
                            onClick={() => setAnswer("")}
                            className="min-h-[44px] px-5 rounded-full glass-chip font-medium inline-flex items-center gap-2"
                        >
                            <RotateCcw className="w-4 h-4" /> Try again
                        </button>
                        <button
                            onClick={reveal}
                            disabled={busy !== null}
                            className="min-h-[44px] px-5 rounded-full glass-chip font-medium inline-flex items-center gap-2"
                        >
                            {busy === "reveal" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} See solution
                        </button>
                    </div>
                )}

                {(q.answer !== undefined || q.working !== undefined) && isDone(q) && (
                    <div className="rounded-2xl border border-border p-5 space-y-3 bg-background/40">
                        {q.working && (
                            <div>
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-2">Working</p>
                                <MarkdownLatex content={q.working} />
                            </div>
                        )}
                        {q.answer && (
                            <div>
                                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium mb-1">Answer</p>
                                <div className="font-semibold"><MarkdownLatex content={q.answer} /></div>
                            </div>
                        )}
                    </div>
                )}

                {error && <p className="text-sm text-red-600 dark:text-red-400" role="alert">{error}</p>}

                {isDone(q) && (nextOpen !== -1 || (anyOpen !== -1 && anyOpen !== current)) && (
                    <button
                        onClick={() => goTo(nextOpen !== -1 ? nextOpen : anyOpen)}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
                    >
                        Next question <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </section>
    );
}
