import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { fetchLessonHistory, submitLessonMessage, type ChatMessage } from "@/lib/api";
import AppSidebar from "@/components/sidebar/AppSidebar";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { MessageSquare } from "lucide-react";
import QuizSection from "@/components/quiz/QuizSection";

export default function LessonChat() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const params = useParams<{ lessonSlug: string }>();
    const lessonSlug = params.lessonSlug || "";

    const [loading, setLoading] = useState(true);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "quiz">("chat");

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const accessToken = session?.access_token || "";

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, sending]);

    // Init: check session + load history
    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session) {
            const loadHistory = async () => {
                setLoading(true);
                try {
                    const history = await fetchLessonHistory(lessonSlug, session.access_token);
                    setMessages(history);
                } catch (err) {
                    console.error("Failed to fetch history:", err);
                }
                setLoading(false);
            };
            loadHistory();
        }
    }, [session, authLoading, navigate, lessonSlug]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    const handleSend = async (content: string) => {
        if (sending) return;

        // Optimistic UI: append user message
        const userMsg: ChatMessage = {
            role: "user",
            content,
        };
        setMessages((prev: ChatMessage[]) => [...prev, userMsg]);
        setSending(true);
        setError(null);

        try {
            const assistantMsg = await submitLessonMessage(lessonSlug, content, accessToken);
            setMessages((prev: ChatMessage[]) => [...prev, assistantMsg]);
        } catch (err) {
            console.error("Failed to send message:", err);
            setError("Failed to get response. Please try again.");
        } finally {
            setSending(false);
        }
    };

    if (authLoading || loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    // Format slug for display: "intro-to-calculus" → "Intro to Calculus"
    const displayTitle = lessonSlug
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar
                userName={userName}
                activeItem="courses"
                onSignOut={handleSignOut}
            />

            {/* Chat area */}
            <div className="flex-1 flex flex-col h-full relative overflow-hidden">
                {/* Chat header */}
                <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-6 py-4 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => navigate("/courses")}
                            className="text-muted-foreground hover:text-muted-foreground transition-colors text-sm"
                        >
                            ← Courses
                        </button>
                        <span className="text-muted-foreground/60">|</span>
                        <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4 text-primary" />
                            <h1 className="text-sm font-semibold text-foreground truncate">
                                {displayTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center bg-card rounded-lg p-1 border border-border">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === "chat" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setActiveTab("quiz")}
                            className={`px-4 py-1 rounded-md text-sm font-medium transition-colors ${activeTab === "quiz" ? "bg-primary/20 text-primary" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Quiz
                        </button>
                    </div>
                </header>

                {activeTab === "quiz" ? (
                    <div className="flex-1 overflow-y-auto">
                        <QuizSection lessonId={lessonSlug} lessonTitle={displayTitle} onClose={() => setActiveTab("chat")} />
                    </div>
                ) : (
                    <>
                        {/* Messages area */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto"
                        >
                            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                                {messages.length === 0 && !sending && (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div
                                            className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4"
                                        >
                                            <MessageSquare className="w-8 h-8 text-primary" />
                                        </div>
                                        <h2
                                            className="text-xl font-bold mb-2"
                                            style={{ textShadow: "0 0 20px rgba(245, 158, 11, 0.15)" }}
                                        >
                                            Start learning
                                        </h2>
                                        <p className="text-muted-foreground text-sm text-center max-w-sm">
                                            Ask Mindfill anything about this lesson. Get clear, layered explanations with deep reasoning.
                                        </p>
                                    </div>
                                )}

                                {messages.map((msg: ChatMessage, idx: number) => (
                                    <ChatBubble key={idx} role={msg.role} content={msg.content} />
                                ))}

                                {sending && <TypingIndicator />}

                                {error && (
                                    <div className="flex justify-center">
                                        <p className="text-red-400/80 text-sm bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                                            {error}
                                        </p>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        </div>

                        {/* Input area */}
                        <ChatInput onSend={handleSend} disabled={sending} />
                    </>
                )}
            </div>
        </div>
    );
}
