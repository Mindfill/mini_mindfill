import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, CircuitBoard as BoardIcon, FileText, Layers, ListChecks, PlayCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { useSubscription } from "@/hooks/use-subscription";
import { useToast } from "@/hooks/use-toast";
import AppSidebar from "@/components/sidebar/AppSidebar";
import TechcessLoader from "@/components/brand/TechcessLoader";
import CircuitBoard from "@/components/secondary/CircuitBoard";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import NoteQuizView from "@/components/notes/NoteQuizView";
import FlashcardsView from "@/components/notes/FlashcardsView";
import { OutOfCreditsError, generateNoteQuiz, type QuizQuestion } from "@/lib/api";
import { fetchNoteBoard, type NoteBoard } from "@/lib/noteLessonApi";
import type { SubsectionType, TocSection } from "@/lib/secondaryApi";

type Tab = "lessons" | "quiz" | "cards";

/**
 * A note's page: its sections as a circuit board (same component and look as
 * the secondary chapter board), each section opening its own lesson.
 * Quiz and Cards live here rather than in the lesson screen (David's call).
 */
export default function NoteBoardPage() {
    const { session, user, isLoading: authLoading, signOut } = useAuth();
    useActivityHeartbeat(session?.access_token);
    const [, navigate] = useLocation();
    const { noteId = "" } = useParams<{ noteId: string }>();
    const accessToken = session?.access_token || "";
    const { promptUpgrade } = useSubscription();
    const { toast } = useToast();

    const [board, setBoard] = useState<NoteBoard | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [tab, setTab] = useState<Tab>("lessons");

    const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
    const [quizSessionId, setQuizSessionId] = useState<string | null>(null);
    const [quizType, setQuizType] = useState<"objective" | "theory">("objective");
    const [generatingQuiz, setGeneratingQuiz] = useState(false);

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    useEffect(() => {
        if (board) document.title = `${board.title} | TECHCESS Notes`;
    }, [board]);

    const load = useCallback(async () => {
        if (!accessToken || !noteId) return;
        setLoadError(false);
        try {
            // No lesson-plan step here any more: each section builds its own
            // plan the first time it's opened.
            setBoard(await fetchNoteBoard(noteId, accessToken));
        } catch (err) {
            console.error("Failed to load note board:", err);
            setLoadError(true);
        }
    }, [accessToken, noteId]);

    useEffect(() => {
        load();
    }, [load]);

    // CircuitBoard is the secondary component, reused as-is. A note's sections
    // are one flat run, so they become the subsections of a single unlabelled
    // group. The chip caption prints unknown types verbatim, hence the cast.
    const boardSections = useMemo<TocSection[]>(() => {
        if (!board) return [];
        return [
            {
                section_id: noteId,
                section_number: 1,
                section_label: "",
                is_complete: board.sections.every((s) => s.state === "done"),
                completed_subsections: board.sections.filter((s) => s.state === "done").length,
                subsections: board.sections.map((s, i) => ({
                    subsection_id: String(s.section_index),
                    subsection_title: s.title,
                    subsection_type: `Section ${String(i + 1).padStart(2, "0")}` as SubsectionType,
                    status: s.state === "done" ? "completed" : s.started ? "in_progress" : "unlocked",
                    // Nothing is locked on a note — any section, any order.
                    available: true,
                })),
            },
        ];
    }, [board, noteId]);

    const handleGenerateQuiz = async (sectionIds: number[], type: "objective" | "theory") => {
        if (!accessToken || sectionIds.length === 0 || generatingQuiz) return;
        setGeneratingQuiz(true);
        try {
            const response = await generateNoteQuiz(noteId, sectionIds, accessToken, type);
            setQuizQuestions(response.questions);
            setQuizSessionId(response.session_id ?? response.quiz_session_id ?? null);
            setQuizType(response.quiz_type ?? type);
        } catch (err) {
            if (err instanceof OutOfCreditsError) promptUpgrade();
            else toast({ variant: "destructive", title: "Couldn't generate quiz", description: "Please try again." });
        } finally {
            setGeneratingQuiz(false);
        }
    };

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };
    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const openSection = (idx: number | string) => navigate(`/notes/${noteId}/sections/${idx}`);

    const shell = (body: React.ReactNode) => (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden">
            <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />
            <div className="flex-1 min-w-0 overflow-y-auto">{body}</div>
        </div>
    );

    if (loadError) {
        return shell(
            <div className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
                <p className="text-muted-foreground">Couldn't load this note.</p>
                <div className="flex gap-3">
                    <button onClick={load} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full text-sm font-semibold">
                        Retry
                    </button>
                    <button onClick={() => navigate("/notes")} className="bg-muted px-6 py-2.5 rounded-full text-sm font-semibold">
                        Back to Notes
                    </button>
                </div>
            </div>,
        );
    }

    if (authLoading || !board) {
        return shell(
            <div className="relative h-full">
                <TechcessLoader label="Loading your note" />
            </div>,
        );
    }

    const total = board.sections.length;
    const done = board.sections.filter((s) => s.state === "done").length;
    const current = board.sections.find((s) => s.section_index === board.current_section) ?? null;

    return shell(
        <main className="max-w-3xl mx-auto px-4 py-6 md:p-10 space-y-7">
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => navigate("/notes")}
                    className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] -ml-1"
                >
                    <ArrowLeft className="w-4 h-4" /> Notes
                </button>
                {board.file_url && (
                    <button
                        onClick={() => navigate(`/notes/${noteId}/read`)}
                        className="h-9 px-3 rounded-full border border-border text-xs font-medium inline-flex items-center gap-1.5 hover:border-primary/50"
                    >
                        <FileText className="w-3.5 h-3.5" /> Read PDF
                    </button>
                )}
            </div>

            <header className="space-y-4">
                <div>
                    <p className="text-xs font-mono text-muted-foreground">{total} {total === 1 ? "section" : "sections"}</p>
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1 break-words">{board.title}</h1>
                </div>
                <ProgressBar value={total ? (done / total) * 100 : 0} complete={total > 0 && done === total} label={`${done} of ${total} sections complete`} />
                {current && (
                    <button
                        onClick={() => openSection(current.section_index)}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2"
                    >
                        <PlayCircle className="w-5 h-5 shrink-0" />
                        <span className="truncate">
                            {done > 0 || current.started ? "Continue" : "Start"}: {current.title}
                        </span>
                    </button>
                )}
            </header>

            <div className="flex justify-end">
                <div className="inline-flex glass-chip rounded-full p-1" role="tablist" aria-label="Note view">
                    {([
                        { id: "lessons" as const, label: "Lessons", Icon: BoardIcon },
                        { id: "quiz" as const, label: generatingQuiz ? "Quiz…" : "Quiz", Icon: ListChecks },
                        { id: "cards" as const, label: "Cards", Icon: Layers },
                    ]).map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            type="button"
                            role="tab"
                            aria-selected={tab === id}
                            onClick={() => setTab(id)}
                            className={`min-h-[36px] px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                                tab === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {tab === "lessons" && (
                <CircuitBoard
                    sections={boardSections}
                    currentId={board.current_section !== null ? String(board.current_section) : null}
                    onOpen={openSection}
                />
            )}

            {/* Kept mounted so a quiz in progress survives switching tabs. */}
            <div style={{ display: tab === "quiz" ? "block" : "none" }}>
                <NoteQuizView
                    questions={quizQuestions}
                    title={board.title}
                    noteId={noteId}
                    accessToken={accessToken}
                    quizSessionId={quizSessionId}
                    quizType={quizType}
                    onClose={() => setTab("lessons")}
                    onGenerate={handleGenerateQuiz}
                    onClearQuiz={() => {
                        setQuizQuestions([]);
                        setQuizSessionId(null);
                        setQuizType("objective");
                    }}
                    generating={generatingQuiz}
                />
            </div>

            {tab === "cards" && <FlashcardsView noteId={noteId} accessToken={accessToken} />}
        </main>,
    );
}
