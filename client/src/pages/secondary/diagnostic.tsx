import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { invalidateSecondaryProgress } from "@/lib/secondaryQueries";
import SecondaryShell, { PageSkeleton } from "@/components/secondary/SecondaryShell";
import DiagnosticPreparing from "@/components/secondary/DiagnosticPreparing";
import MarkdownLatex from "@/components/ui/markdown-latex";
import OptionChoices from "@/components/quiz/OptionChoices";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import { ChevronLeft, Loader2, ArrowRight, RotateCcw, Lock } from "lucide-react";
import {
    fetchDiagnostic,
    submitDiagnostic,
    SecondaryApiError,
    type DiagnosticExam,
    type DiagnosticOutcome,
} from "@/lib/secondaryApi";

/**
 * The way past a locked lesson.
 *
 * A student who opens a lesson they haven't earned lands here instead of a
 * dead end. The exam is written by the tutor against the PREREQUISITES of that
 * lesson — the ones they're skipping — and passing opens that one lesson.
 *
 * Everything the student reads in the tutor's voice (the intro, and the verdict
 * at the end) comes from the server: it is generated with the questions and
 * cached alongside them, so it is the same for everyone who skips to the same
 * place and costs nothing to show.
 */
export default function DiagnosticPage() {
    const { subsectionId } = useParams<{ subsectionId: string }>();
    return (
        <SecondaryShell>
            {({ accessToken }) => <Diagnostic subsectionId={subsectionId} accessToken={accessToken} />}
        </SecondaryShell>
    );
}

function Diagnostic({ subsectionId, accessToken }: { subsectionId: string; accessToken: string }) {
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const [exam, setExam] = useState<DiagnosticExam | null>(null);
    const [loadError, setLoadError] = useState<SecondaryApiError | Error | null>(null);
    const [started, setStarted] = useState(false);
    const [answers, setAnswers] = useState<Record<string, string>>({});
    const [current, setCurrent] = useState(0);
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState<string | null>(null);
    const [outcome, setOutcome] = useState<DiagnosticOutcome | null>(null);

    useEffect(() => {
        let cancelled = false;
        setExam(null);
        setLoadError(null);
        fetchDiagnostic(subsectionId, accessToken)
            .then((res) => {
                if (!cancelled) setExam(res);
            })
            .catch((err) => {
                if (!cancelled) setLoadError(err instanceof Error ? err : new Error("Couldn't load this"));
            });
        return () => {
            cancelled = true;
        };
    }, [subsectionId, accessToken]);

    useEffect(() => {
        if (exam) document.title = `Skip ahead — ${exam.subsection_title} | TECHCESS`;
    }, [exam]);

    const backToChapter = () => navigate("/secondary/learn");

    if (loadError) return <DiagnosticUnavailable error={loadError} onBack={backToChapter} />;
    if (!exam) return <DiagnosticPreparing />;
    if (outcome) {
        return (
            <Verdict
                exam={exam}
                outcome={outcome}
                onOpenLesson={() => navigate(`/secondary/subsections/${subsectionId}`)}
                onRetry={() => {
                    setOutcome(null);
                    setAnswers({});
                    setCurrent(0);
                    setStarted(true);
                }}
                onBack={backToChapter}
            />
        );
    }
    if (!started) return <Intro exam={exam} onStart={() => setStarted(true)} onBack={backToChapter} />;

    const question = exam.questions[current];
    const chosen = answers[question.id] ?? null;
    const answeredCount = exam.questions.filter((q) => answers[q.id]).length;
    const isLast = current === exam.questions.length - 1;

    const handleSubmit = async () => {
        setSubmitting(true);
        setSubmitError(null);
        try {
            const result = await submitDiagnostic(subsectionId, answers, accessToken);
            setOutcome(result);
            // A pass writes an unlock row, so every cached listing that shows
            // this lesson as locked is now wrong.
            if (result.passed) await invalidateSecondaryProgress(queryClient);
        } catch (err) {
            const e = err instanceof SecondaryApiError ? err : null;
            setSubmitError(
                e?.reason === "no_attempts_left"
                    ? "You've used both goes at this one. The lessons before it are the way through now."
                    : err instanceof Error
                      ? err.message
                      : "Couldn't mark your answers",
            );
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
            <Header exam={exam} onBack={backToChapter} />

            <ProgressBar
                value={(answeredCount / exam.questions.length) * 100}
                complete={answeredCount === exam.questions.length}
                label={`Question ${current + 1} of ${exam.questions.length}`}
            />

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
                <MarkdownLatex content={question.question_text} className="text-[15px]" />
                <OptionChoices
                    name={question.id}
                    options={question.options.map((o) => ({ letter: o.letter.toUpperCase(), text: o.text }))}
                    selectedLetter={chosen ? chosen.toUpperCase() : null}
                    onSelect={(option) =>
                        setAnswers((prev) => ({ ...prev, [question.id]: option.letter.toLowerCase() }))
                    }
                    disabled={submitting}
                />
            </div>

            {submitError && (
                <p className="text-sm text-red-700 dark:text-red-400" role="alert">
                    {submitError}
                </p>
            )}

            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => setCurrent((i) => Math.max(i - 1, 0))}
                    disabled={current === 0 || submitting}
                    className="min-h-[44px] px-4 rounded-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-40"
                >
                    Back
                </button>

                {isLast ? (
                    <button
                        onClick={handleSubmit}
                        // Unanswered questions are marked wrong, so submitting a
                        // half-finished paper is a real choice, not a mistake to
                        // block — but the student must have answered something.
                        disabled={submitting || answeredCount === 0}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        {answeredCount < exam.questions.length ? "Submit anyway" : "Submit"}
                    </button>
                ) : (
                    <button
                        onClick={() => setCurrent((i) => Math.min(i + 1, exam.questions.length - 1))}
                        disabled={!chosen || submitting}
                        className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2 disabled:opacity-50"
                    >
                        Next <ArrowRight className="w-4 h-4" />
                    </button>
                )}
            </div>
        </main>
    );
}

function Header({ exam, onBack }: { exam: DiagnosticExam; onBack: () => void }) {
    return (
        <div className="space-y-3">
            <button
                onClick={onBack}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] -ml-1"
            >
                <ChevronLeft className="w-4 h-4" /> Back to lessons
            </button>
            <div>
                <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">
                    Skip check · {exam.chapter_title}
                </p>
                <h1 className="text-2xl md:text-3xl font-semibold tracking-tight mt-1">{exam.subsection_title}</h1>
            </div>
        </div>
    );
}

function Intro({
    exam,
    onStart,
    onBack,
}: {
    exam: DiagnosticExam;
    onStart: () => void;
    onBack: () => void;
}) {
    const needed = exam.questions.length - exam.allowed_wrong;
    return (
        <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
            <Header exam={exam} onBack={onBack} />

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground">
                    TECHCESS
                </p>
                <MarkdownLatex content={exam.intro} className="text-[15px] leading-relaxed" />

                <dl className="grid grid-cols-3 gap-3 pt-2 border-t border-border">
                    <Stat label="Questions" value={String(exam.questions.length)} />
                    <Stat label="To pass" value={`${needed} right`} />
                    <Stat
                        label="Goes left"
                        value={`${exam.attempts_remaining} of ${exam.attempts_allowed}`}
                    />
                </dl>
            </div>

            <button
                onClick={onStart}
                className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2"
            >
                Start <ArrowRight className="w-4 h-4" />
            </button>
        </main>
    );
}

function Stat({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</dt>
            <dd className="text-sm font-semibold mt-0.5">{value}</dd>
        </div>
    );
}

function Verdict({
    exam,
    outcome,
    onOpenLesson,
    onRetry,
    onBack,
}: {
    exam: DiagnosticExam;
    outcome: DiagnosticOutcome;
    onOpenLesson: () => void;
    onRetry: () => void;
    onBack: () => void;
}) {
    const questionById = useMemo(
        () => new Map(exam.questions.map((q) => [q.id, q])),
        [exam.questions],
    );

    return (
        <main className="max-w-2xl mx-auto px-4 py-8 md:p-10 space-y-6">
            <Header exam={exam} onBack={onBack} />

            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-4">
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-semibold">
                        {outcome.correct_count}/{outcome.question_count}
                    </span>
                    <span
                        className={`text-sm font-medium ${
                            outcome.passed
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "text-amber-700 dark:text-amber-400"
                        }`}
                    >
                        {outcome.passed ? "Passed" : "Not this time"}
                    </span>
                </div>
                <p className="text-[10px] uppercase tracking-[0.05em] font-semibold text-muted-foreground">
                    TECHCESS
                </p>
                <MarkdownLatex content={outcome.message} className="text-[15px] leading-relaxed" />

                <div className="flex flex-wrap gap-3 pt-2">
                    {outcome.passed ? (
                        <button
                            onClick={onOpenLesson}
                            className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
                        >
                            Open the lesson <ArrowRight className="w-4 h-4" />
                        </button>
                    ) : outcome.attempts_remaining > 0 ? (
                        <>
                            <button
                                onClick={onRetry}
                                className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
                            >
                                <RotateCcw className="w-4 h-4" /> Try again
                                <span className="text-xs opacity-80">
                                    ({outcome.attempts_remaining} left)
                                </span>
                            </button>
                            <button
                                onClick={onBack}
                                className="min-h-[48px] px-6 rounded-full glass-chip font-medium"
                            >
                                Do the lessons instead
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={onBack}
                            className="min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium"
                        >
                            Back to the lessons
                        </button>
                    )}
                </div>
            </div>

            {/* The review. Shown whichever way it went — a pass with one wrong
                is exactly the case where the explanation is worth reading. */}
            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                    How it went
                </h2>
                {outcome.results.map((result, i) => {
                    const question = questionById.get(result.id);
                    if (!question) return null;
                    return (
                        <div key={result.id} className="glass-panel rounded-2xl p-5 space-y-3">
                            <div className="flex items-start gap-2">
                                <span
                                    className={`text-xs font-semibold mt-0.5 ${
                                        result.correct
                                            ? "text-emerald-700 dark:text-emerald-400"
                                            : "text-red-700 dark:text-red-400"
                                    }`}
                                >
                                    {i + 1}. {result.correct ? "✓" : "✗"}
                                </span>
                                <MarkdownLatex
                                    content={question.question_text}
                                    className="text-sm flex-1 [&_p]:mb-0"
                                />
                            </div>
                            <OptionChoices
                                name={`review-${result.id}`}
                                options={question.options.map((o) => ({
                                    letter: o.letter.toUpperCase(),
                                    text: o.text,
                                }))}
                                selectedLetter={result.given ? result.given.toUpperCase() : null}
                                correctLetter={result.answer.toUpperCase()}
                                onSelect={() => {}}
                                disabled
                            />
                            {result.explanation && (
                                <div className="text-sm text-muted-foreground border-l-2 border-border pl-3">
                                    <MarkdownLatex
                                        content={result.explanation}
                                        className="text-inherit [&_p]:mb-0"
                                    />
                                </div>
                            )}
                        </div>
                    );
                })}
            </section>
        </main>
    );
}

/** Every reason the exam can't be offered, each with a way out. */
function DiagnosticUnavailable({ error, onBack }: { error: unknown; onBack: () => void }) {
    const e = error instanceof SecondaryApiError ? error : null;

    let title = "Couldn't load the skip check";
    let body = "Check your connection and try again.";

    if (e?.reason === "no_attempts_left") {
        title = "You've used both goes at this";
        body = "The lessons before this one are the way through now. They won't take long.";
    } else if (e?.reason === "already_available") {
        title = "This lesson is already open";
        body = "No check needed — go straight in.";
    } else if (e?.reason === "no_prerequisites") {
        title = "Nothing to test here yet";
        body = "There's no material in front of this lesson to check you on. Work through the chapter in order for now.";
    } else if (e?.reason === "generation_failed") {
        title = "Couldn't write the check";
        body = "That's on us, not you. Try again in a moment, or just do the lessons before this one.";
    } else if (e?.status === 402 || e?.reason === "subscription_required") {
        title = "This chapter is part of the full course";
        body = "Chapter 0 is free. Subscribe to unlock every chapter.";
    }

    return (
        <div className="flex items-center justify-center px-4 py-16">
            <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4" role="alert">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-muted-foreground text-sm">{body}</p>
                <button
                    onClick={onBack}
                    className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium"
                >
                    Back to lessons
                </button>
            </div>
        </div>
    );
}
