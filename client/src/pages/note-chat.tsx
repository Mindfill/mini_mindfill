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
import { X, ArrowLeft, BookOpen, FileText, RotateCcw, RefreshCw } from "lucide-react";
import mindfillIcon from "@/assets/mindfill.png";
import NoteQuizView from "@/components/notes/NoteQuizView";
import SectionSelector, { type PlanSection } from "@/components/notes/SectionSelector";
import { useToast } from "@/hooks/use-toast";

// Per-note cache (keyed by noteId) so returning to a note restores its title,
// PDF link, sections and conversation without re-hitting the DB / API.
// Persisted to sessionStorage so it also survives a full reload within the tab.
type NoteChatCacheEntry = {
    noteTitle: string;
    noteUrl: string | null;
    sections: PlanSection[];
    messages: NoteChatMessage[];
};

const NOTE_CHAT_CACHE_KEY = "techcess:note-chat-cache";

function loadNoteChatCache(): Record<string, NoteChatCacheEntry> {
    try {
        const raw = sessionStorage.getItem(NOTE_CHAT_CACHE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

const noteChatCache: Record<string, NoteChatCacheEntry> = loadNoteChatCache();

function persistNoteChatCache() {
    try {
        sessionStorage.setItem(NOTE_CHAT_CACHE_KEY, JSON.stringify(noteChatCache));
    } catch {
        // storage full/unavailable — cache stays in memory only
    }
}

function clearNoteChatCache() {
    for (const k in noteChatCache) delete noteChatCache[k];
    try {
        sessionStorage.removeItem(NOTE_CHAT_CACHE_KEY);
    } catch {
        // ignore
    }
}

export default function NoteChat() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const params = useParams<{ noteId: string }>();
    const noteId = params.noteId || "";

    const cached = noteId ? noteChatCache[noteId] : undefined;

    const [noteTitle, setNoteTitle] = useState(cached?.noteTitle ?? "Note");
    const [noteUrl, setNoteUrl] = useState<string | null>(cached?.noteUrl ?? null);
    const [loading, setLoading] = useState(!cached);
    const [hasLoaded, setHasLoaded] = useState(!!cached);
    const [refreshing, setRefreshing] = useState(false);
    const [onboarding, setOnboarding] = useState(false);
    const [messages, setMessages] = useState<NoteChatMessage[]>(cached?.messages ?? []);
    const [sending, setSending] = useState(false);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [retryContent, setRetryContent] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<"chat" | "quiz">("chat");
    const [lessonPlan, setLessonPlan] = useState<NoteLessonPlanResponse | null>(null);
    const [sections, setSections] = useState<PlanSection[]>(cached?.sections ?? []);
    const [selectedSections, setSelectedSections] = useState<string[]>([]);
    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [generatingQuiz, setGeneratingQuiz] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const accessToken = session?.access_token || "";
    const { toast } = useToast();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const fetchedForToken = useRef<string | null>(null);

    // Load note details and history
    const loadNoteData = async () => {
        if (!session || !noteId) return;

        setLoading(true);
        setLoadError(null);

        try {
            // First, load note details
            const { data: noteData, error: noteError } = await supabase
                .from("notes")
                .select("title, file_url")
                .eq("id", noteId)
                .single();

            if (noteError) throw noteError;
            setNoteTitle(noteData.title);
            setNoteUrl(noteData.file_url ?? null);

            // Load the lesson-plan sections (if onboarding already happened).
            // The /onboard endpoint only returns structured sections on first
            // generation, so read them straight from the table on return visits.
            try {
                const { data: planData } = await supabase
                    .from("note_lesson_plans")
                    .select("content")
                    .eq("note_id", noteId)
                    .maybeSingle();

                if (planData?.content) {
                    const parsed = JSON.parse(planData.content);
                    if (Array.isArray(parsed?.sections)) {
                        setSections(parsed.sections as PlanSection[]);
                    }
                }
            } catch (planErr) {
                console.warn("Could not load lesson plan sections:", planErr);
            }

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
            setLoadError("Could not load note data");
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    };

    const handleOnboard = async () => {
        if (!session || !noteId) return;

        setOnboarding(true);

        try {
            const plan = await onboardNote(noteId, accessToken);
            setLessonPlan(plan);
            if (plan.lesson_plan?.sections) {
                setSections(plan.lesson_plan.sections as PlanSection[]);
            }
            // Display the onboarding message as first message
            setMessages([
                { role: "assistant", content: plan.onboarding_message }
            ]);
        } catch (err) {
            console.error("Failed to onboard note:", err);
            toast({
                variant: "destructive",
                title: "Couldn't generate lesson plan",
                description: "Please try again in a moment.",
            });
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

            // Reuse cached note data; otherwise fetch. Refresh forces a reload.
            if (noteChatCache[noteId]) {
                setHasLoaded(true);
                setLoading(false);
            } else {
                loadNoteData();
            }
        }
    }, [session, authLoading, navigate, noteId]);

    // Keep the cache in sync so back-navigation restores the latest conversation.
    useEffect(() => {
        if (hasLoaded && noteId) {
            noteChatCache[noteId] = { noteTitle, noteUrl, sections, messages };
            persistNoteChatCache();
        }
    }, [hasLoaded, noteId, noteTitle, noteUrl, sections, messages]);

    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await loadNoteData();
        setRefreshing(false);
    };

    const handleSignOut = async () => {
        clearNoteChatCache();
        await supabaseSignOut();
        navigate("/login");
    };

    // Send a message. On failure the endpoint can be retried without
    // re-appending the user's bubble (addBubble=false on retry).
    const doSend = async (content: string, addBubble = true) => {
        if (sending || !session) return;

        if (addBubble) {
            setMessages((prev) => [...prev, { role: "user", content }]);
        }
        setSending(true);
        setError(null);
        setRetryContent(null);

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
            setError("Failed to get a response.");
            setRetryContent(content);
        } finally {
            setSending(false);
        }
    };

    const handleSend = (content: string) => doSend(content, true);

    const handleGenerateQuiz = async () => {
        if (!session || sections.length === 0 || generatingQuiz) return;

        setGeneratingQuiz(true);
        try {
            const response = await generateNoteQuiz(noteId, selectedSections, accessToken);
            setQuizQuestions(response.questions);
            setActiveTab("quiz");
        } catch (err) {
            console.error("Failed to generate quiz:", err);
            toast({
                variant: "destructive",
                title: "Couldn't generate quiz",
                description: "Please try again.",
            });
        } finally {
            setGeneratingQuiz(false);
        }
    };

    if (authLoading || (loading && !hasLoaded && !loadError)) {
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
    if (!loading && messages.length === 0 && !onboarding && !loadError) {
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

    if (loadError) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                        <X className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Connection Error</h2>
                    <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                        {loadError}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={() => loadNoteData()}
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
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar
                userName={userName}
                activeItem="notes"
                onSignOut={handleSignOut}
            />

            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
                {/* Header */}
                <header className="bg-background/40 backdrop-blur-xl border-b border-border px-4 md:px-6 py-4 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={() => navigate("/notes")}
                            className="text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 flex-shrink-0"
                            aria-label="Back to Notes"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-bold tracking-widest uppercase">Notes</span>
                        </button>
                        <div className="h-4 w-px bg-border flex-shrink-0" />
                        <img
                            src={mindfillIcon}
                            alt="TECHCESS"
                            className="w-8 h-8 rounded-lg object-cover flex-shrink-0"
                        />
                        <h1 className="text-sm font-bold text-foreground tracking-tight truncate min-w-0">
                            {noteTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={handleRefresh}
                            disabled={refreshing}
                            className="text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-full p-2 transition-colors disabled:opacity-50"
                            aria-label="Refresh"
                            title="Refresh"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                        </button>
                        {noteUrl && (
                            <a
                                href={noteUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-full p-2 transition-colors"
                                aria-label="View PDF"
                                title="View PDF"
                            >
                                <FileText className="w-4 h-4" />
                            </a>
                        )}
                        <div className="flex items-center bg-muted rounded-full p-1 border border-border">
                            <button
                                onClick={() => setActiveTab("chat")}
                                className={`px-4 md:px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "chat" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                Chat
                            </button>
                            <button
                                onClick={() => setActiveTab("quiz")}
                                className={`px-4 md:px-6 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === "quiz" ? "bg-primary text-primary-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
                            >
                                {generatingQuiz ? "…" : "Quiz"}
                            </button>
                        </div>
                    </div>
                </header>

                {/* Quiz tab */}
                <div className="flex-1 overflow-y-auto" style={{ display: activeTab === "quiz" ? "block" : "none" }}>
                    <NoteQuizView
                        questions={quizQuestions}
                        title={noteTitle}
                        onClose={() => setActiveTab("chat")}
                        onRegenerate={handleGenerateQuiz}
                        regenerating={generatingQuiz}
                    />
                </div>

                {/* Chat tab */}
                <div className="flex-1 flex flex-col min-h-0" style={{ display: activeTab === "chat" ? "flex" : "none" }}>
                    <SectionSelector
                        sections={sections}
                        selected={selectedSections}
                        onChange={setSelectedSections}
                        disabled={sending}
                    />
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

                            {error && !sending && (
                                <div className="flex justify-center">
                                    <div className="flex items-center gap-3 text-red-400/90 text-sm bg-red-500/10 px-4 py-2 rounded-lg border border-red-500/20">
                                        <span>{error}</span>
                                        {retryContent && (
                                            <button
                                                onClick={() => doSend(retryContent, false)}
                                                className="flex items-center gap-1 font-bold text-red-300 hover:text-red-200 transition-colors"
                                            >
                                                <RotateCcw className="w-3.5 h-3.5" /> Retry
                                            </button>
                                        )}
                                    </div>
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
