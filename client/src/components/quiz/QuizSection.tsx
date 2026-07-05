import { useState, useEffect, useRef } from "react";
import { fetchQuestions, fetchTimedBatch, submitAttempt, submitBatchAttempts, fetchStats, fetchExplanation } from "@/lib/quizApi";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { BookOpen, GraduationCap, Timer as TimerIcon, ChevronRight, CheckCircle, XCircle, Send, Loader2, ArrowLeft, X } from "lucide-react";

interface QuizSectionProps {
    lessonId: string;
    lessonTitle: string;
    onClose: () => void;
}

export default function QuizSection({ lessonId, lessonTitle, onClose }: QuizSectionProps) {
    const [screen, setScreen] = useState<1 | 2 | 3 | 4>(1);
    const [mode, setMode] = useState<"mcq" | "flashcard" | "timed">("mcq");

    // Config
    const [layer, setLayer] = useState<"L1" | "L2">("L1");
    const [difficulty, setDifficulty] = useState<"Easy" | "Medium" | "Hard">("Easy");

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Active screen state
    const [questions, setQuestions] = useState<any[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    // MCQ State
    const [selectedOption, setSelectedOption] = useState<any>(null);
    const [submitted, setSubmitted] = useState(false);
    const [feedbackData, setFeedbackData] = useState<any>(null);

    // Flashcard State
    const [flipped, setFlipped] = useState(false);

    // Timed State
    const [answers, setAnswers] = useState<any[]>([]);
    const answersRef = useRef<any[]>([]);
    useEffect(() => { answersRef.current = answers; }, [answers]);
    const [timeLeft, setTimeLeft] = useState(900);
    const [timerActive, setTimerActive] = useState(false);
    const [timerExpired, setTimerExpired] = useState(false);

    // Results State
    const [stats, setStats] = useState<any>(null);

    // Explanation Modal State
    const [showExplain, setShowExplain] = useState(false);
    const [explainHistory, setExplainHistory] = useState<any[]>([]);
    const [inputText, setInputText] = useState("");
    const [explainLoading, setExplainLoading] = useState(false);
    const [explainContext, setExplainContext] = useState<{ qIndex: number; q: any; studentAnswer: string; correctAnswer: string } | null>(null);

    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showExplain) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [explainHistory, showExplain]);

    // Timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timerActive && timeLeft > 0) {
            interval = setInterval(() => {
                setTimeLeft((prev) => prev - 1);
            }, 1000);
        } else if (timerActive && timeLeft <= 0) {
            setTimerExpired(true);
            setTimerActive(false);
            // Use setTimeout to avoid React state update during render
            setTimeout(() => handleTimedBatchSubmit(answersRef.current), 0);
        }
        return () => clearInterval(interval);
    }, [timerActive, timeLeft]);

    // --- Actions ---

    const handleStartConfig = async () => {
        setLoading(true);
        setError(null);
        try {
            let res;
            if (mode === "timed") {
                res = await fetchTimedBatch(lessonId, layer.toLowerCase(), difficulty.toLowerCase());
            } else {
                res = await fetchQuestions(lessonId, mode, layer.toLowerCase(), difficulty.toLowerCase());
            }

            if (!res || res.length === 0) {
                setError("No questions available for this combination yet. Try a different layer or difficulty.");
            } else {
                setQuestions(res);
                setCurrentIndex(0);
                setScreen(3);
                setAnswers([]);
                if (mode === "timed") {
                    setTimeLeft(900);
                    setTimerActive(true);
                }
            }
        } catch (err: any) {
            setError(err.message || "Failed to load questions. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handleMcqSubmit = async () => {
        if (!selectedOption || submitted) return;
        setLoading(true);
        setError(null);
        try {
            const correct = Boolean(selectedOption.is_correct);
            setAnswers((prev) => [...prev, {
                question_id: questions[currentIndex].id,
                lesson_id: lessonId,
                correct,
                student_answer: selectedOption.text
            }]);
            const res = await submitAttempt(questions[currentIndex].id, lessonId, correct, selectedOption.text);
            setFeedbackData({
                correct,
                correct_answer: res.correct_answer || questions[currentIndex].options.find((o: any) => o.is_correct)?.text,
                explanation: res.explanation || questions[currentIndex].explanation,
            });
            setSubmitted(true);
        } catch (err: any) {
            console.error("Backend attempt failed, falling back to local evaluation:", err);
            const correct = Boolean(selectedOption.is_correct);
            setFeedbackData({
                correct,
                correct_answer: questions[currentIndex].options.find((o: any) => o.is_correct)?.text,
                explanation: questions[currentIndex].explanation || (correct ? "Correct!" : "Incorrect."),
            });
            setSubmitted(true);
        } finally {
            setLoading(false);
        }
    };

    const handleFlashcardAttempt = async (correct: boolean) => {
        setLoading(true);
        setError(null);

        const studentAns = correct ? "self-reported correct" : "self-reported incorrect";
        const newAnswer = {
            question_id: questions[currentIndex].id,
            lesson_id: lessonId,
            correct,
            student_answer: studentAns
        };
        const newAnswers = [...answers, newAnswer];
        setAnswers(newAnswers);

        try {
            await submitAttempt(questions[currentIndex].id, lessonId, correct, studentAns);
        } catch (err: any) {
            console.error("Backend attempt failed:", err);
        } finally {
            setLoading(false);
            handleNextQuestion(newAnswers);
        }
    };

    const handleTimedNext = () => {
        const correct = selectedOption ? Boolean(selectedOption.is_correct) : (flipped ? true : false); // Default to false if not provided properly
        const studentAnswer = selectedOption ? selectedOption.text : (flipped ? "self-reported" : "skipped");

        setAnswers((prev) => [...prev, {
            question_id: questions[currentIndex].id,
            lesson_id: lessonId,
            correct,
            student_answer: studentAnswer
        }]);

        if (currentIndex + 1 >= questions.length) {
            handleTimedBatchSubmit([...answers, {
                question_id: questions[currentIndex].id,
                lesson_id: lessonId,
                correct,
                student_answer: studentAnswer
            }]);
        } else {
            setCurrentIndex((prev) => prev + 1);
            setSelectedOption(null);
            setFlipped(false);
        }
    };

    const handleTimedBatchSubmit = async (finalAnswers = answers) => {
        setTimerActive(false);
        setLoading(true);
        try {
            if (finalAnswers.length > 0) {
                await submitBatchAttempts(finalAnswers);
            }
            await finishQuizLoadStats(finalAnswers);
        } catch (err: any) {
            console.error("Backend batch attempt failed, falling back to local stats.", err);
            await finishQuizLoadStats(finalAnswers);
        }
    };

    const handleNextQuestion = (currentAnswers = answers) => {
        setSelectedOption(null);
        setSubmitted(false);
        setFeedbackData(null);
        setFlipped(false);
        setShowExplain(false);
        setExplainHistory([]);

        if (currentIndex + 1 >= questions.length) {
            finishQuizLoadStats(currentAnswers);
        } else {
            setCurrentIndex((prev) => prev + 1);
        }
    };

    const finishQuizLoadStats = async (finalAnswers = answers) => {
        setLoading(true);
        try {
            await fetchStats(lessonId);
            const sessionCorrect = finalAnswers.filter((a: any) => a.correct).length;
            const sessionTotal = questions.length;
            setStats({
                correct: sessionCorrect,
                total: sessionTotal,
                accuracy: sessionTotal > 0 ? (sessionCorrect / sessionTotal) * 100 : 0
            });
            setScreen(4);
        } catch (err: any) {
            console.warn("Failed to load stats from backend. Using local evaluation.");
            const sessionCorrect = finalAnswers.filter((a: any) => a.correct).length;
            const sessionTotal = questions.length;
            setStats({
                correct: sessionCorrect,
                total: sessionTotal,
                accuracy: sessionTotal > 0 ? (sessionCorrect / sessionTotal) * 100 : 0
            });
            setScreen(4);
        } finally {
            setLoading(false);
        }
    };

    // Explanation Chat
    const openExplanation = async (qIndex: number, stAnswer: string) => {
        const q = questions[qIndex];
        const cAnswer = q.type === "mcq" ? q.options?.find((o: any) => o.is_correct)?.text : q.answer || q.explanation;

        setExplainContext({ qIndex, q, studentAnswer: stAnswer, correctAnswer: cAnswer });
        setShowExplain(true);
        setExplainLoading(true);
        setExplainHistory([]);

        try {
            const res = await fetchExplanation(lessonId, q.question, cAnswer, stAnswer, []);
            setExplainHistory([{ role: "assistant", content: res.message }]);
        } catch (err: any) {
            setExplainHistory([{ role: "assistant", content: "Sorry, I couldn't load the explanation at the moment." }]);
        } finally {
            setExplainLoading(false);
        }
    };

    const sendExplainMessage = async () => {
        if (!inputText.trim() || !explainContext) return;
        const newUserMsg = { role: "user", content: inputText };
        const newHistory = [...explainHistory, newUserMsg];
        setExplainHistory(newHistory);
        setInputText("");
        setExplainLoading(true);

        try {
            const res = await fetchExplanation(lessonId, explainContext.q.question, explainContext.correctAnswer, explainContext.studentAnswer, newHistory);
            setExplainHistory([...newHistory, { role: "assistant", content: res.message }]);
        } catch (err: any) {
            setExplainHistory([...newHistory, { role: "assistant", content: "Error communicating. Please try again." }]);
        } finally {
            setExplainLoading(false);
        }
    };

    // --- Renderers ---

    const renderScreen1 = () => (
        <div className="max-w-4xl mx-auto py-12 px-6">
            <h2 className="text-2xl font-bold mb-8 text-center" style={{ textShadow: "0 0 30px rgba(245, 158, 11, 0.15)" }}>Choose your mode</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[
                    { id: "mcq", title: "MCQ", desc: "Test your knowledge with multiple choice questions", icon: <BookOpen className="w-8 h-8 text-emerald-400 mb-4" /> },
                    { id: "flashcard", title: "Flashcard", desc: "Flip through concepts and self-assess", icon: <GraduationCap className="w-8 h-8 text-purple-400 mb-4" /> },
                    { id: "timed", title: "Timed Quiz", desc: "15 questions against the clock", icon: <TimerIcon className="w-8 h-8 text-blue-400 mb-4" /> }
                ].map(m => (
                    <button
                        key={m.id}
                        onClick={() => { setMode(m.id as any); setScreen(2); setError(null); }}
                        className="flex flex-col items-center text-center p-8 rounded-2xl border border-border bg-card hover:bg-card hover:-translate-y-1 hover:border-muted-foreground/30 transition-all duration-300"
                    >
                        {m.icon}
                        <h3 className="text-lg font-bold text-foreground mb-2">{m.title}</h3>
                        <p className="text-sm text-muted-foreground">{m.desc}</p>
                    </button>
                ))}
            </div>
        </div>
    );

    const renderScreen2 = () => (
        <div className="max-w-xl mx-auto py-12 px-6">
            <button onClick={() => setScreen(1)} className="flex items-center text-sm text-muted-foreground hover:text-foreground mb-8">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back
            </button>
            <h2 className="text-2xl font-bold mb-8" style={{ textShadow: "0 0 30px rgba(245, 158, 11, 0.15)" }}>Quiz Settings</h2>

            <div className="space-y-8 bg-card border border-border rounded-2xl p-8">
                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-4">Focus Layer</label>
                    <div className="flex gap-4">
                        {["L1", "L2"].map(l => (
                            <button
                                key={l}
                                onClick={() => setLayer(l as any)}
                                className={`flex-1 py-3 px-4 rounded-xl border text-sm font-semibold transition-colors ${layer === l ? "bg-primary/20 border-primary text-primary" : "bg-card border-border text-muted-foreground hover:bg-muted"}`}
                            >
                                {l === "L1" ? "L1 — Intuition" : "L2 — Symbolic"}
                            </button>
                        ))}
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-muted-foreground mb-4">Difficulty</label>
                    <div className="flex gap-3">
                        {["Easy", "Medium", "Hard"].map(d => (
                            <button
                                key={d}
                                onClick={() => setDifficulty(d as any)}
                                className={`flex-1 py-3 px-2 rounded-xl border text-sm font-semibold transition-colors ${difficulty === d ? "bg-muted border-muted-foreground/30 text-foreground" : "bg-card border-border text-muted-foreground hover:bg-card"}`}
                            >
                                {d}
                            </button>
                        ))}
                    </div>
                </div>

                {error && <p className="text-red-400 text-sm bg-red-400/10 p-4 rounded-xl border border-red-400/20">{error}</p>}

                <button
                    onClick={handleStartConfig}
                    disabled={loading}
                    className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg hover:brightness-110 transition-all disabled:opacity-50 flex justify-center items-center"
                >
                    {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Start Quiz"}
                </button>
            </div>
        </div>
    );

    const renderProgressBar = () => (
        <div className="w-full max-w-2xl mx-auto mb-8">
            <div className="flex justify-between text-xs text-muted-foreground mb-2 font-medium tracking-wider">
                <span>QUESTION {currentIndex + 1} OF {questions.length}</span>
                {mode === "timed" && (
                    <span className={`font-mono text-sm flex items-center gap-1 ${timeLeft < 60 ? "text-red-500" : "text-foreground/90"}`}>
                        <TimerIcon className="w-4 h-4" />
                        {Math.floor(Math.max(0, timeLeft) / 60).toString().padStart(2, "0")}:{(Math.max(0, timeLeft) % 60).toString().padStart(2, "0")}
                    </span>
                )}
            </div>
            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                <div
                    className="h-full bg-primary transition-all duration-500 ease-out"
                    style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
            </div>
        </div>
    );

    const renderExplanationModal = () => (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setShowExplain(false)} />
            <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[80vh] overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-border bg-card">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Loader2 className={`w-4 h-4 text-primary ${explainLoading ? "animate-spin" : "opacity-0"}`} />
                        Explanation Chat
                    </h3>
                    <button onClick={() => setShowExplain(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {explainHistory.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${msg.role === "user"
                                ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
                                : "bg-card border border-border text-foreground rounded-tl-sm"
                                }`}>
                                <MarkdownLatex content={msg.content} />
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>

                <div className="p-4 border-t border-border bg-background">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && sendExplainMessage()}
                            placeholder="Ask a follow-up question..."
                            className="w-full bg-card border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            disabled={explainLoading}
                        />
                        <button
                            onClick={sendExplainMessage}
                            disabled={explainLoading || !inputText.trim()}
                            className="absolute right-2 p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    const renderActiveScreen = () => {
        const q = questions[currentIndex];
        const isFlashcard = mode === "flashcard" || (mode === "timed" && q.type === "flashcard");
        const isMcq = mode === "mcq" || (mode === "timed" && q.type !== "flashcard");

        return (
            <div className="w-full max-w-2xl mx-auto py-8 px-6 pb-24 relative">
                <button
                    onClick={() => { setScreen(1); setTimerActive(false); }}
                    className="absolute top-0 right-6 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Exit Quiz
                </button>
                {renderProgressBar()}

                <div className="mb-8">
                    {isFlashcard ? (
                        <div className="perspective-1000 w-full h-80">
                            <div className={`relative w-full h-full duration-700 preserve-3d cursor-pointer ${flipped ? 'rotate-y-180' : ''}`} onClick={() => setFlipped(true)}>
                                {/* Front */}
                                <div className="absolute w-full h-full backface-hidden flex items-center justify-center p-8 bg-card border border-border rounded-2xl shadow-xl overflow-y-auto">
                                    <div className="text-center w-full">
                                        <MarkdownLatex content={q.question} className="text-xl text-foreground font-medium" />
                                    </div>
                                    <p className="absolute bottom-4 text-xs text-foreground/40 uppercase tracking-widest">Click to flip</p>
                                </div>
                                {/* Back */}
                                <div className="absolute w-full h-full backface-hidden rotate-y-180 flex items-center justify-center p-8 bg-card border border-muted-foreground/30 rounded-2xl shadow-xl overflow-y-auto">
                                    <div className="text-center w-full space-y-4">
                                        <p className="text-sm text-muted-foreground uppercase tracking-widest font-semibold">Answer</p>
                                        <MarkdownLatex content={q.answer || q.explanation} className="text-lg text-foreground" />
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card border border-border rounded-2xl p-8 mb-6 shadow-xl">
                            <div className="mb-8">
                                <MarkdownLatex content={q.question} className="text-lg text-foreground font-medium" />
                            </div>
                            <div className="space-y-3">
                                {q.options?.map((opt: any, i: number) => {
                                    const isSelected = selectedOption === opt;
                                    const isCorrectOpt = opt.is_correct;
                                    let btnClass = "border-border hover:bg-card text-foreground/90";

                                    if (submitted) {
                                        if (isCorrectOpt) {
                                            btnClass = "border-emerald-500/50 bg-emerald-500/10 text-emerald-400";
                                        } else if (isSelected && !isCorrectOpt) {
                                            btnClass = "border-red-500/50 bg-red-500/10 text-red-400";
                                        } else {
                                            btnClass = "border-border opacity-50 text-muted-foreground";
                                        }
                                    } else if (isSelected) {
                                        btnClass = "border-primary bg-primary/5 text-foreground";
                                    }

                                    return (
                                        <button
                                            key={i}
                                            disabled={submitted || loading}
                                            onClick={() => setSelectedOption(opt)}
                                            className={`w-full text-left p-4 rounded-xl border transition-all duration-200 flex items-start ${btnClass}`}
                                        >
                                            <span className="mr-3 text-muted-foreground font-mono text-sm mt-0.5">{String.fromCharCode(65 + i)}</span>
                                            <div className="flex-1">
                                                <MarkdownLatex content={opt.text} className="text-foreground" />
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Timed Mode Actions — MCQ: Next button, Flashcard: Yes/No prompt */}
                {mode === "timed" && (
                    isFlashcard && flipped ? (
                        <div className="flex flex-col gap-4 mt-6">
                            <h4 className="text-center font-medium text-lg text-foreground mb-2">Did you get this correct?</h4>
                            <div className="flex gap-4">
                                <button onClick={() => handleFlashcardAttempt(false)} disabled={loading} className="flex-1 py-4 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-medium transition-colors">
                                    {currentIndex + 1 >= questions.length ? "No (Finish)" : "No"}
                                </button>
                                <button onClick={() => handleFlashcardAttempt(true)} disabled={loading} className="flex-1 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-bold transition-colors">
                                    {currentIndex + 1 >= questions.length ? "Yes (Finish)" : "Yes"}
                                </button>
                            </div>
                        </div>
                    ) : !isFlashcard && (
                        <div className="flex justify-end mt-8">
                            <button
                                onClick={handleTimedNext}
                                disabled={!selectedOption}
                                className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center hover:brightness-110 transition-colors disabled:opacity-50"
                            >
                                {currentIndex + 1 >= questions.length ? "Finish Quiz" : "Next"} <ChevronRight className="w-5 h-5 ml-1" />
                            </button>
                        </div>
                    )
                )}

                {/* Flashcard Actions (pure flashcard mode) */}
                {mode === "flashcard" && !submitted && flipped && (
                    <div className="flex flex-col gap-4 mt-6">
                        <h4 className="text-center font-medium text-lg text-foreground mb-2">Did you get this correct?</h4>
                        <div className="flex gap-4">
                            <button onClick={() => handleFlashcardAttempt(false)} disabled={loading} className="flex-1 py-4 rounded-xl border border-red-500/30 bg-red-500/5 hover:bg-red-500/10 text-red-500 font-medium transition-colors">
                                {currentIndex + 1 >= questions.length ? "No (Finish)" : "No"}
                            </button>
                            <button onClick={() => handleFlashcardAttempt(true)} disabled={loading} className="flex-1 py-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 font-bold transition-colors">
                                {currentIndex + 1 >= questions.length ? "Yes (Finish)" : "Yes"}
                            </button>
                        </div>
                    </div>
                )}

                {/* MCQ / Flashcard Feedback */}
                {submitted && feedbackData && mode !== "timed" && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className={`p-6 rounded-2xl border ${feedbackData.correct ? "bg-emerald-500/10 border-emerald-500/20" : "bg-red-500/10 border-red-500/20"} mb-6`}>
                            <h4 className={`flex items-center gap-2 font-bold mb-3 ${feedbackData.correct ? "text-emerald-400" : "text-red-400"}`}>
                                {feedbackData.correct ? <CheckCircle className="w-5 h-5" /> : <XCircle className="w-5 h-5" />}
                                {feedbackData.correct ? "Correct" : "Incorrect"}
                            </h4>
                            {feedbackData.correct_answer && !feedbackData.correct && (
                                <div className="text-sm text-foreground/90 mb-3 flex gap-1">
                                    <span className="text-muted-foreground flex-shrink-0">Correct answer:</span>
                                    <MarkdownLatex content={feedbackData.correct_answer} />
                                </div>
                            )}
                            <MarkdownLatex content={feedbackData.explanation} className="text-sm leading-relaxed text-foreground/90" />

                            {!feedbackData.correct && (
                                <button onClick={() => openExplanation(currentIndex, selectedOption ? selectedOption.text : "self-reported incorrect")} className="mt-4 px-4 py-2 rounded-lg bg-muted text-foreground hover:bg-muted text-sm font-medium transition-colors">
                                    I still don't get it
                                </button>
                            )}
                        </div>

                        <div className="flex justify-end">
                            <button
                                onClick={() => handleNextQuestion()}
                                className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center hover:brightness-110 transition-all"
                            >
                                {currentIndex + 1 >= questions.length ? "Finish Quiz" : "Next Question"} <ChevronRight className="w-5 h-5 ml-1" />
                            </button>
                        </div>
                    </div>
                )}

                {/* MCQ Submit Button */}
                {mode === "mcq" && !submitted && (
                    <div className="flex justify-end mt-6">
                        <button
                            onClick={handleMcqSubmit}
                            disabled={!selectedOption || loading}
                            className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold flex items-center hover:brightness-110 transition-colors disabled:opacity-50"
                        >
                            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />} {currentIndex + 1 >= questions.length ? "Submit & Finish" : "Submit"}
                        </button>
                    </div>
                )}
            </div>
        );
    };

    const renderScreen4 = () => {
        let msg = "Keep going. Revisit the lesson chat and come back to this.";
        let accuracy = stats?.accuracy || 0;
        if (stats && stats.total > 0) {
            if (accuracy >= 80) msg = "Strong work. Your understanding of this lesson is solid.";
            else if (accuracy >= 50) msg = "Good effort. Review the questions you missed and try again.";
        }

        return (
            <div className="max-w-3xl mx-auto py-12 px-6 animate-in fade-in zoom-in-95 duration-500 pb-32">
                <div className="text-center mb-16">
                    <div className="w-24 h-24 mx-auto bg-gradient-to-br from-primary to-blue-500 rounded-full flex items-center justify-center p-[2px] mb-8 shadow-[0_0_40px_rgba(245, 158, 11,0.2)]">
                        <div className="w-full h-full bg-background rounded-full flex items-center justify-center">
                            <CheckCircle className="w-10 h-10 text-primary" />
                        </div>
                    </div>

                    <h2 className="text-4xl font-bold text-foreground mb-2">{stats?.correct || 0} <span className="text-muted-foreground text-2xl">/ {stats?.total || 0}</span></h2>
                    <p className="text-primary font-semibold tracking-wide mb-6">{Math.round(accuracy)}% ACCURACY</p>

                    <p className="text-muted-foreground text-lg mb-12">{msg}</p>

                    <div className="flex flex-col sm:flex-row justify-center gap-4">
                        <button onClick={() => setScreen(1)} className="px-8 py-3 rounded-xl border border-border hover:bg-card transition-colors text-foreground font-medium">
                            Try Again
                        </button>
                        <button onClick={onClose} className="px-8 py-3 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-colors">
                            Back to Lesson
                        </button>
                    </div>
                </div>

                {(mode === "timed" || mode === "mcq" || mode === "flashcard") && questions.length > 0 && (
                    <div className="space-y-6">
                        <h3 className="text-2xl font-bold mb-6 border-b border-border pb-4">Review Your Answers</h3>
                        {questions.map((q, i) => {
                            const ans = answers[i];
                            const isCorrect = ans ? ans.correct : false;
                            const studentAnsText = ans ? ans.student_answer : "Unanswered";
                            const correctAnsText = q.type === "mcq" ? q.options?.find((o: any) => o.is_correct)?.text : q.answer || q.explanation;

                            return (
                                <div key={i} className={`p-6 rounded-2xl border ${isCorrect ? 'border-emerald-500/20 bg-emerald-500/5' : 'border-red-500/20 bg-red-500/5'}`}>
                                    <div className="flex items-start justify-between gap-4 mb-4">
                                        <div className="flex-1"><MarkdownLatex content={`${i + 1}. ${q.question}`} className="text-lg font-medium text-foreground" /></div>
                                        {isCorrect ? (
                                            <span className="flex items-center gap-1 text-emerald-500 font-medium text-sm bg-emerald-500/10 px-3 py-1 rounded-full"><CheckCircle className="w-4 h-4" /> Correct</span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-red-500 font-medium text-sm bg-red-500/10 px-3 py-1 rounded-full"><XCircle className="w-4 h-4" /> Incorrect</span>
                                        )}
                                    </div>

                                    <div className="space-y-3 mb-6">
                                        <div className="flex flex-col">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Your Answer</span>
                                            <MarkdownLatex content={studentAnsText} className={`text-sm font-medium ${isCorrect ? 'text-emerald-500' : 'text-red-500'}`} />
                                        </div>
                                        {!isCorrect && (
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Correct Answer</span>
                                                <MarkdownLatex content={correctAnsText} className="text-sm font-medium text-foreground/90" />
                                            </div>
                                        )}
                                        <div className="flex flex-col pt-3 border-t border-border/50">
                                            <span className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Explanation</span>
                                            <MarkdownLatex content={q.explanation} className="text-sm text-foreground/80 leading-relaxed" />
                                        </div>
                                    </div>

                                    <div className="pt-2">
                                        {!isCorrect ? (
                                            <button
                                                onClick={() => openExplanation(i, studentAnsText)}
                                                className="px-4 py-2 rounded-lg bg-card border border-border hover:bg-muted text-sm font-medium transition-colors flex items-center gap-2"
                                            >
                                                <Send className="w-4 h-4" /> I still don't get it
                                            </button>
                                        ) : (
                                            <button
                                                onClick={() => openExplanation(i, studentAnsText)}
                                                className="px-4 py-2 rounded-lg bg-card border border-border hover:bg-muted text-emerald-500/80 hover:text-emerald-500 text-sm font-medium transition-colors flex items-center gap-2"
                                            >
                                                <Send className="w-4 h-4" /> Discuss Further
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="w-full min-h-[calc(100vh-80px)] bg-background text-foreground relative">
            <style dangerouslySetInnerHTML={{
                __html: `
                .perspective-1000 { perspective: 1000px; }
                .preserve-3d { transform-style: preserve-3d; }
                .backface-hidden { backface-visibility: hidden; }
                .rotate-y-180 { transform: rotateY(180deg); }
            `}} />

            {screen === 1 && renderScreen1()}
            {screen === 2 && renderScreen2()}
            {screen === 3 && renderActiveScreen()}
            {screen === 4 && renderScreen4()}

            {showExplain && renderExplanationModal()}
        </div>
    );
}
