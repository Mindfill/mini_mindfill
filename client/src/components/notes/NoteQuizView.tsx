import { useMemo, useState } from "react";
import type { QuizQuestion } from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import {
    CheckCircle,
    XCircle,
    ChevronRight,
    Loader2,
    RefreshCw,
    Sparkles,
    ArrowLeft,
} from "lucide-react";

interface NoteQuizViewProps {
    questions: QuizQuestion[];
    title: string;
    onClose: () => void;
    onRegenerate: () => void;
    regenerating?: boolean;
}

const normalize = (s: string) => (s ?? "").trim();

/**
 * Interactive multiple-choice quiz driven entirely by the questions returned
 * from POST /notes/{note_id}/quiz. Correctness is evaluated locally by
 * matching the selected option against `correct_answer`.
 */
export default function NoteQuizView({
    questions,
    title,
    onClose,
    onRegenerate,
    regenerating = false,
}: NoteQuizViewProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [selected, setSelected] = useState<string | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [answers, setAnswers] = useState<(string | null)[]>([]);
    const [finished, setFinished] = useState(false);

    const total = questions.length;
    const current = questions[currentIndex];

    // `answer` and `correct_answer` are option ids.
    const isCorrect = (q: QuizQuestion, answerId: string | null) =>
        answerId != null && normalize(answerId) === normalize(q.correct_answer);

    // Resolve an option id to its display text (falls back to the id itself).
    const optionText = (q: QuizQuestion, id: string | null) =>
        (id != null && q.options.find((o) => normalize(o.id) === normalize(id))?.text) || (id ?? "Unanswered");

    const score = useMemo(
        () => answers.reduce((acc, a, i) => acc + (isCorrect(questions[i], a) ? 1 : 0), 0),
        [answers, questions]
    );

    const reset = () => {
        setCurrentIndex(0);
        setSelected(null);
        setSubmitted(false);
        setAnswers([]);
        setFinished(false);
    };

    const handleSubmit = () => {
        if (selected == null || submitted) return;
        setAnswers((prev) => {
            const next = [...prev];
            next[currentIndex] = selected;
            return next;
        });
        setSubmitted(true);
    };

    const handleNext = () => {
        if (currentIndex + 1 >= total) {
            setFinished(true);
        } else {
            setCurrentIndex((i) => i + 1);
            setSelected(null);
            setSubmitted(false);
        }
    };

    // ── Empty / not-yet-generated state ───────────────────────────────────
    if (total === 0) {
        return (
            <div className="max-w-2xl mx-auto py-16 px-6 text-center flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Sparkles className="w-8 h-8 text-primary" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">No quiz yet</h2>
                <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                    Generate a set of questions from your selected sections to test what you've learned.
                </p>
                <button
                    onClick={onRegenerate}
                    disabled={regenerating}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                >
                    {regenerating ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Generating...
                        </>
                    ) : (
                        <>
                            <Sparkles className="w-4 h-4" /> Generate Quiz
                        </>
                    )}
                </button>
            </div>
        );
    }

    // ── Results screen ────────────────────────────────────────────────────
    if (finished) {
        const accuracy = total > 0 ? (score / total) * 100 : 0;
        let msg = "Keep going. Revisit the note chat and try again.";
        if (accuracy >= 80) msg = "Strong work. Your understanding of this note is solid.";
        else if (accuracy >= 50) msg = "Good effort. Review what you missed and try again.";

        return (
            <div className="max-w-3xl mx-auto py-12 px-6 pb-32 animate-in fade-in zoom-in-95 duration-500">
                <div className="text-center mb-16">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-blue-500 rounded-full flex items-center justify-center p-[2px] mb-8">
                        <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-primary" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-foreground mb-2">
                        {score} <span className="text-muted-foreground text-2xl">/ {total}</span>
                    </h2>
                    <p className="text-primary font-semibold tracking-wide mb-6">
                        {Math.round(accuracy)}% ACCURACY
                    </p>
                    <p className="text-muted-foreground text-lg mb-12">{msg}</p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button
                            onClick={reset}
                            className="px-8 py-3 rounded-xl border border-border hover:bg-card transition-colors text-foreground font-medium"
                        >
                            Try Again
                        </button>
                        <button
                            onClick={onRegenerate}
                            disabled={regenerating}
                            className="px-8 py-3 rounded-xl border border-border hover:bg-card transition-colors text-foreground font-medium flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {regenerating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <RefreshCw className="w-4 h-4" />
                            )}
                            New Questions
                        </button>
                        <button
                            onClick={onClose}
                            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-colors"
                        >
                            Back to Chat
                        </button>
                    </div>
                </div>

                {/* Review */}
                <div className="space-y-6">
                    <h3 className="text-2xl font-bold mb-6 border-b border-border pb-4">Review Your Answers</h3>
                    {questions.map((q, i) => {
                        const ans = answers[i] ?? null;
                        const correct = isCorrect(q, ans);
                        return (
                            <div
                                key={q.id ?? i}
                                className={`p-6 rounded-2xl border ${
                                    correct ? "border-emerald-500/20 bg-emerald-500/5" : "border-red-500/20 bg-red-500/5"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4 mb-4">
                                    <div className="flex-1">
                                        <MarkdownLatex
                                            content={`${i + 1}. ${q.question}`}
                                            className="text-lg text-foreground font-medium"
                                        />
                                    </div>
                                    {correct ? (
                                        <span className="flex-shrink-0 flex items-center gap-1 text-emerald-500 font-medium text-sm bg-emerald-500/10 px-3 py-1 rounded-full">
                                            <CheckCircle className="w-4 h-4" /> Correct
                                        </span>
                                    ) : (
                                        <span className="flex-shrink-0 flex items-center gap-1 text-red-500 font-medium text-sm bg-red-500/10 px-3 py-1 rounded-full">
                                            <XCircle className="w-4 h-4" /> Incorrect
                                        </span>
                                    )}
                                </div>

                                <div className="space-y-3">
                                    <div className="flex flex-col">
                                        <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                            Your Answer
                                        </span>
                                        <span className={`text-sm font-medium ${correct ? "text-emerald-500" : "text-red-500"}`}>
                                            {optionText(q, ans)}
                                        </span>
                                    </div>
                                    {!correct && (
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                                Correct Answer
                                            </span>
                                            <span className="text-sm font-medium text-foreground/90">{optionText(q, q.correct_answer)}</span>
                                        </div>
                                    )}
                                    {q.explanation && (
                                        <div className="flex flex-col pt-3 border-t border-border/50">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">
                                                Explanation
                                            </span>
                                            <MarkdownLatex
                                                content={q.explanation}
                                                className="text-sm text-foreground/80 leading-relaxed"
                                            />
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // ── Active question screen ────────────────────────────────────────────
    const answeredCorrect = submitted && isCorrect(current, selected);

    return (
        <div className="w-full max-w-2xl mx-auto py-8 px-6 pb-24 relative">
            <button
                onClick={onClose}
                className="absolute top-0 right-6 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> Exit Quiz
            </button>

            {/* Progress */}
            <div className="w-full max-w-2xl mx-auto mb-8">
                <div className="flex justify-between text-xs text-muted-foreground mb-2 font-medium tracking-wider">
                    <span>QUESTION {currentIndex + 1} OF {total}</span>
                    <span className="truncate max-w-[200px] text-muted-foreground/70">{title}</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${((currentIndex + 1) / total) * 100}%` }}
                    />
                </div>
            </div>

            {/* Question card */}
            <div className="bg-card border border-border rounded-2xl p-8 mb-6 shadow-xl">
                <div className="mb-8">
                    <MarkdownLatex content={current.question} className="text-lg text-foreground font-medium" />
                </div>
                <div className="space-y-3">
                    {current.options.map((opt, i) => {
                        const isSelected = selected === opt.id;
                        const isCorrectOpt = normalize(opt.id) === normalize(current.correct_answer);
                        let btnClass = "border-border hover:bg-muted text-foreground/90";

                        if (submitted) {
                            if (isCorrectOpt) {
                                btnClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
                            } else if (isSelected) {
                                btnClass = "border-red-500/50 bg-red-500/10 text-red-400";
                            } else {
                                btnClass = "border-border opacity-50 text-muted-foreground";
                            }
                        } else if (isSelected) {
                            btnClass = "border-primary bg-primary/5 text-foreground";
                        }

                        return (
                            <button
                                key={opt.id ?? i}
                                disabled={submitted}
                                onClick={() => setSelected(opt.id)}
                                className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start ${btnClass}`}
                            >
                                <span className="mr-3 text-muted-foreground font-mono text-sm mt-0.5">
                                    {String.fromCharCode(65 + i)}
                                </span>
                                <div className="flex-1">
                                    <MarkdownLatex content={opt.text} className="text-inherit" />
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Feedback */}
            {submitted && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div
                        className={`p-6 rounded-2xl border mb-6 ${
                            answeredCorrect ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"
                        }`}
                    >
                        <h4
                            className={`flex items-center gap-2 font-bold mb-3 ${
                                answeredCorrect ? "text-emerald-400" : "text-red-400"
                            }`}
                        >
                            {answeredCorrect ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                            {answeredCorrect ? "Correct" : "Incorrect"}
                        </h4>
                        {!answeredCorrect && (
                            <div className="text-sm text-foreground/90 mb-3 flex gap-1">
                                <span className="text-muted-foreground flex-shrink-0">Correct answer:</span>
                                <span className="font-medium">{optionText(current, current.correct_answer)}</span>
                            </div>
                        )}
                        {current.explanation && (
                            <MarkdownLatex
                                content={current.explanation}
                                className="text-sm leading-relaxed text-foreground/90"
                            />
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleNext}
                            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center hover:brightness-110 transition-all"
                        >
                            {currentIndex + 1 >= total ? "Finish Quiz" : "Next Question"}
                            <ChevronRight className="w-5 h-5 ml-1" />
                        </button>
                    </div>
                </div>
            )}

            {/* Submit */}
            {!submitted && (
                <div className="flex justify-end mt-6">
                    <button
                        onClick={handleSubmit}
                        disabled={selected == null}
                        className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center hover:brightness-110 transition-colors disabled:opacity-50"
                    >
                        {currentIndex + 1 >= total ? "Submit & Finish" : "Submit"}
                    </button>
                </div>
            )}
        </div>
    );
}
