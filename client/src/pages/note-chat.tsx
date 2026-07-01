import { useEffect, useState, useRef } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import {
    fetchNoteHistory,
    sendNoteChatMessage,
    onboardNote,
    generateNoteQuiz,
    type NoteChatMessage,
    type NoteChatRequest,
    type NoteLessonPlanResponse,
    type QuizQuestion
} from "@/lib/api";
import AppSidebar from "@/components/sidebar/AppSidebar";
import ChatBubble from "@/components/chat/ChatBubble";
import ChatInput from "@/components/chat/ChatInput";
import TypingIndicator from "@/components/chat/TypingIndicator";
import { X, ArrowLeft, BookOpen, CheckCircle2 } from "lucide-react";
import mindfillIcon from "@/assets/mindfill.png";
import QuizSection from "@/components/quiz/QuizSection";

export default function NoteChat() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const params = useParams<{ noteId: string }>();
    const noteId = params.noteId || "";

    const [noteTitle, setNoteTitle] = useState("Note");
    const [loading, setLoading] = useState(true);
    const [onboarding, setOnboarding] = useState(false);
    const [messages, setMessages] = useState<NoteChatMessage[]>([]);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "quiz">("chat");
    const [lessonPlan, setLessonPlan] = useState<NoteLessonPlanResponse | null>(null);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [generatingQuiz, setGeneratingQuiz] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const accessToken = session?.access_token || "";

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fetchedForToken = useRef<string | null>(null);

    // Load note details and history
    const loadNoteData = async () => {
        if (!session || !noteId) return;

        setLoading(true);
        setError(null);

        try {
            // First, load note details
            const { data: noteData, error: noteError } = await supabase
                .from("notes")
                .select("title")
                .eq("id", noteId)
                .single();

            if (noteError) throw noteError;
            setNoteTitle(noteData.title);

            // Check if lesson plan exists by trying to fetch history
            try {
                const history = await fetchNoteHistory(noteId, accessToken);
                setMessages(history);
            } catch {
                // If history fails, maybe we need to onboard first
                // Don't set error yet, we'll handle onboarding
            }
        } catch (err) {
            console.error("Failed to load note:", err);
            setError("Could not load note data");
        } finally {
            setLoading(false);
        }
    };

    const handleOnboard = async () => {
        if (!session || !noteId) return;

        setOnboarding(true);
        setError(null);

        try {
            const plan = await onboardNote(noteId, accessToken);
            setLessonPlan(plan);
            // Display the onboarding message as first message
            setMessages([
                { role: "assistant", content: plan.onboarding_message }
            ]);
        } catch (err) {
            console.error("Failed to onboard note:", err);
            setError("Failed to generate lesson plan for this note");
        } finally {
            setOnboarding(false);
        }
    };

    useEffect(() => {
        document.title = `${noteTitle} | TECHCESS Notes`;
    }, [noteTitle]);

    useEffect(() => {
        const timer = setTimeout(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }, 0);
        return () => clearTimeout(timer);
    }, [messages, sending]);

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session && noteId) {
            const key = `${session.access_token}::note::${noteId}`;
            if (fetchedForToken.current === key) return;
            fetchedForToken.current = key;

            loadNoteData();
        }
    }, [session, authLoading, navigate, noteId]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    const handleSend = async (content: string) => {
        if (sending || !session) return;

        const userMsg: NoteChatMessage = { role: "user", content };
        setMessages((prev) => [...prev, userMsg]);
        setSending(true);
        setError(null);

        try {
            const request: NoteChatRequest = {
                role: "user",
                content,
                selected_sections: selectedSections.length > 0 ? selectedSections : undefined
            };
            const response = await sendNoteChatMessage(noteId, request, accessToken);
            
            setMessages((prev) => [...prev, { role: "assistant", content: response.content }]);
        } catch (err) {
            console.error("Failed to send message:", err);
            setError("Failed to get response. Please try again.");
        } finally {
            setSending(false);
        }
    };

    const handleGenerateQuiz = async () => {
        if (!session || !lessonPlan || generatingQuiz) return;

        setGeneratingQuiz(true);
        try {
            const response = await generateNoteQuiz(noteId, selectedSections, accessToken);
            setQuizQuestions(response.questions);
            setActiveTab("quiz");
        } catch (err) {
            console.error("Failed to generate quiz:", err);
            setError("Failed to generate quiz");
        } finally {
            setGeneratingQuiz(false);
        }
    };

    if (authLoading || (loading && !error)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="courses" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground animate-pulse">
                        Loading Note...
                    </p>
                </div>
            </div>
        );
    }

    // Onboarding required screen
    if (!loading && messages.length === 0 && !onboarding && !error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="courses" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 text-center">
                    <img
                        src={mindfillIcon}
                        alt="TECHCESS"
                        className="w-20 h-20 rounded-2xl mb-6"
                    />
                    <h2 className="text-2xl font-bold mb-3 text-foreground">Ready to Learn?</h2>
                    <p className="text-muted-foreground max-w-md mb-8 leading-relaxed">
                        Let's process your note and create a personalized learning experience.
                    </p>
                    <button
                        onClick={handleOnboard}
                        disabled={onboarding}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 py-3 rounded-full font-bold text-sm transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {onboarding ? (
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                Generating Lesson Plan...
                            </div>
                        ) : (
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-4 h-4" />
                                Start Learning This Note
                            </div>
                        )}
                    </button>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="courses" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                        <X className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Connection Error</h2>
                    <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                        {error}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => window.location.reload()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Retry
                        </button>
                        <button
                            onClick={() => navigate("/notes")}
                            className="bg-muted text-foreground hover:bg-muted/80 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Back to Notes
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground flex">
            <AppSidebar
                userName={userName}
                activeItem="notes"
                onSignOut={handleSignOut}
            />

            <div className="flex-1 flex flex-col min-h-screen bg-background">
                {/* Header */}
                <header className="sticky top-0 z-20 bg-background/40 backdrop-blur-xl border-b border-border px-6 py-5 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => navigate("/notes")}
                            className="text-muted-foreground hover:text-foreground transition-all text-xs font-bold tracking-widest uppercase flex items-center gap-1"
                        >
                            <ArrowLeft className="w-3 h-3" /> Back to Notes
                        </button>
                        <div className="h-4 w-px bg-border" />
                        <div className="flex items-center gap-3">
                            <img
                                src={mindfillIcon}
                                alt="TECHCESS"
                                className="w-8 h-8 rounded-lg object-cover"
                            />
                            <h1 className="text-sm font-bold text-foreground tracking-tight truncate max-w-[200px] md:max-w-md">
                                {noteTitle}
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center bg-muted rounded-full p-1 border border-border">
                        <button
                            onClick={() => setActiveTab("chat")}
                            className={`px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "chat" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            Chat
                        </button>
                        <button
                            onClick={() => {
                                if (quizQuestions.length === 0) {
                                    handleGenerateQuiz();
                                } else {
                                    setActiveTab("quiz");
                                }
                            }}
                            disabled={generatingQuiz}
                            className={`px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "quiz" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                        >
                            {generatingQuiz ? "Generating..." : "Quiz"}
                        </button>
                    </div>
                </header>

                {/* Quiz tab */}
                <div className="flex-1 overflow-y-auto" style={{ display: activeTab === "quiz" ? "block" : "none" }}>
                    <QuizSection
                        lessonId={noteId}
                        lessonTitle={noteTitle}
                        onClose={() => setActiveTab("chat")}
                    />
                </div>

                {/* Chat tab */}
                <div className="flex-1 flex flex-col min-h-0" style={{ display: activeTab === "chat" ? "flex" : "none" }}>
                    <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
                        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
                            {messages.length === 0 && !sending && (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <img
                                        src={mindfillIcon}
                                        alt="TECHCESS"
                                        className="w-16 h-16 rounded-2xl object-cover mb-4"
                                    />
                                    <h2 className="text-xl font-bold mb-2 text-foreground">Start learning</h2>
                                    <p className="text-muted-foreground text-sm text-center max-w-sm">
                                        Ask TECHCESS anything about your note. Get clear, layered explanations with deep reasoning.
                                    </p>
                                </div>
                            )}

                            {messages.map((msg: NoteChatMessage, idx: number) => (
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

                    <ChatInput onSend={handleSend} disabled={sending} />
                </div>
            </div>
        </div>
    );
}
