import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { fetchLessonHistory, submitLessonMessage, type ChatMessage } from "@/lib/api";
import AppSidebar from "@/components/sidebar/AppSidebar";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { MessageSquare, X } from "lucide-react";
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

    console.log("[LessonChat] Rendering:", { lessonSlug, authLoading, loading, hasSession: !!session });

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            scrollToBottom();
        }, 0);
        return () => clearTimeout(timer);
    }, [messages, sending]);

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session) {
            const loadHistory = async () => {
                setLoading(true);
                setError(null);
                try {
                    const history = await fetchLessonHistory(lessonSlug, session.access_token);
                    setMessages(history);
                } catch (err) {
                    console.error("Failed to fetch history:", err);
                    setError("Could not connect to the knowledge server. Please ensure the backend is running.");
                } finally {
                    setLoading(false);
                }
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

        const userMsg: ChatMessage = { role: "user", content };
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

    if (authLoading || (loading && !error)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="courses" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-black">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-white/20 animate-pulse">
                        Synchronizing Knowledge...
                    </p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="courses" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-black p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                        <X className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
                    <p className="text-white/40 max-w-sm mb-8 leading-relaxed">
                        {error}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-white text-black hover:bg-white/90 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Retry Connection
                        </button>
                        <button
                            onClick={() => navigate("/courses")}
                            className="bg-white/5 text-white hover:bg-white/10 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Back to Courses
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const displayTitle = lessonSlug
        .split("-")
        .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ");

    useEffect(() => {
        document.title = `${displayTitle} | TECHCESS`;
    }, [displayTitle]);

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <AppSidebar
                userName={userName}
                activeItem="courses"
                onSignOut={handleSignOut}
            />

            {/* Chat area */}
            <div className="flex-1 flex flex-col min-h-screen bg-black">
                {/* Chat header */}
                <header className="sticky top-0 z-20 bg-black/40 backdrop-blur-xl border-b border-white/5 px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/courses")}
                            className="text-white/30 hover:text-white transition-all text-xs font-bold tracking-widest uppercase"
                        >
                            ← Back
                        </button>
                        <div className="h-4 w-px bg-white/10" />
                        <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                                <MessageSquare className="w-4 h-4 text-primary" />
                            </div>
                            <h1 className="text-sm font-bold text-white tracking-tight truncate max-w-[200px] md:max-w-md">
                                {displayTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "chat" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => setActiveTab("quiz")}
                            className={`px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "quiz" ? "bg-white text-black shadow-lg" : "text-white/40 hover:text-white"}`}
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
                    <div className="flex-1 flex flex-col min-h-0">
                        {/* Messages area */}
                        <div
                            ref={scrollContainerRef}
                            className="flex-1 overflow-y-auto"
                        >
                            <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                                {messages.length === 0 && !sending && (
                                    <div className="flex flex-col items-center justify-center py-20">
                                        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                                            <MessageSquare className="w-8 h-8 text-primary" />
                                        </div>
                                        <h2
                                            className="text-xl font-bold mb-2 text-white"
                                        >
                                            Start learning
                                        </h2>
                                        <p className="text-white/40 text-sm text-center max-w-sm">
                                            Ask TECHCESS anything about this lesson. Get clear, layered explanations with deep reasoning.
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
                    </div>
                )}
            </div>
        </div>
    );
}