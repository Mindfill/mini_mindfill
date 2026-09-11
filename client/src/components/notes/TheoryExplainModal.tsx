import { useEffect, useRef, useState } from "react";
import { explainTheoryAnswer } from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { Loader2, X, Send } from "lucide-react";

export interface TheoryExplainContext {
    question: string;
    options: string[];
    studentAnswer: string;
    correctAnswer: string;
    explanation: string;
    difficulty?: string;
}

interface ExplainMessage {
    role: "user" | "assistant";
    content: string;
}

interface TheoryExplainModalProps {
    noteId: string;
    accessToken: string;
    context: TheoryExplainContext;
    onClose: () => void;
}

/**
 * On-demand, stateless explanation chat for a wrong theory-quiz answer.
 * Mirrors QuizSection.tsx's explanation modal pattern, backed by
 * POST /notes/{note_id}/quiz/explain (gpt-5.6-luna) instead of /quiz/explain.
 * No history is persisted server-side — this component owns it entirely.
 */
export default function TheoryExplainModal({ noteId, accessToken, context, onClose }: TheoryExplainModalProps) {
    const [history, setHistory] = useState<ExplainMessage[]>([]);
    const [loading, setLoading] = useState(false);
    const [inputText, setInputText] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [history]);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setHistory([]);
        explainTheoryAnswer(
            noteId,
            {
                question: context.question,
                options: context.options,
                student_answer: context.studentAnswer,
                correct_answer: context.correctAnswer,
                explanation: context.explanation,
                difficulty: context.difficulty,
            },
            accessToken
        )
            .then((res) => {
                if (!cancelled) setHistory([{ role: "assistant", content: res.message }]);
            })
            .catch(() => {
                if (!cancelled) setHistory([{ role: "assistant", content: "Sorry, I couldn't load the explanation right now." }]);
            })
            .finally(() => {
                if (!cancelled) setLoading(false);
            });
        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [context.question]);

    const sendMessage = async () => {
        if (!inputText.trim() || loading) return;
        const newHistory: ExplainMessage[] = [...history, { role: "user", content: inputText }];
        setHistory(newHistory);
        setInputText("");
        setLoading(true);

        try {
            const res = await explainTheoryAnswer(
                noteId,
                {
                    question: context.question,
                    options: context.options,
                    student_answer: context.studentAnswer,
                    correct_answer: context.correctAnswer,
                    explanation: context.explanation,
                    difficulty: context.difficulty,
                    history: newHistory,
                },
                accessToken
            );
            setHistory([...newHistory, { role: "assistant", content: res.message }]);
        } catch {
            setHistory([...newHistory, { role: "assistant", content: "Error communicating. Please try again." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={onClose} />
            <div className="relative w-full max-w-lg bg-card border border-border rounded-2xl shadow-2xl flex flex-col h-[80vh] overflow-hidden">
                <div className="flex justify-between items-center p-4 border-b border-border bg-card">
                    <h3 className="font-semibold text-foreground flex items-center gap-2">
                        <Loader2 className={`w-4 h-4 text-primary ${loading ? "animate-spin" : "opacity-0"}`} />
                        Explain this
                    </h3>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {history.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                            <div
                                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                                    msg.role === "user"
                                        ? "bg-primary/10 border border-primary/20 text-foreground rounded-tr-sm"
                                        : "bg-card border border-border text-foreground rounded-tl-sm"
                                }`}
                            >
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
                            onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                            placeholder="Ask a follow-up question..."
                            className="w-full bg-card border border-border rounded-xl pl-4 pr-12 py-3 text-sm text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                            disabled={loading}
                        />
                        <button
                            onClick={sendMessage}
                            disabled={loading || !inputText.trim()}
                            className="absolute right-2 p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
