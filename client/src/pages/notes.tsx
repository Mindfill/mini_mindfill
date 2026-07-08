import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { supabase } from "@/lib/supabase";
import { Note, Course, fetchCourses } from "@/lib/api";
import { Plus, FileSearch, FolderPlus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import NoteUploadModal from "@/components/notes/NoteUploadModal";
import NoteCourseCard from "@/components/notes/NoteCourseCard";
import NoteCard from "@/components/notes/NoteCard";
import CreateCourseDialog from "@/components/notes/CreateCourseDialog";
import { RefreshCw } from "lucide-react";

type CourseStats = Record<string, { count: number; progress: number }>;

// Module-level cache so navigating back to /notes reuses the last load instead
// of re-hitting the DB. Only replaced when the data is (re)fetched — a full
// browser reload clears it. Refresh is user-triggered.
let notesCache: {
    userId: string;
    notes: Note[];
    courses: Course[];
    courseStats: CourseStats;
} | null = null;

export default function NotesDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();

    const cached = session && notesCache?.userId === session.user.id ? notesCache : null;

    const [loading, setLoading] = useState(!cached);
    const [hasLoaded, setHasLoaded] = useState(!!cached);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>(cached?.notes ?? []);
    const [courses, setCourses] = useState<Course[]>(cached?.courses ?? []);
    const [courseStats, setCourseStats] = useState<CourseStats>(cached?.courseStats ?? {});
    const [uploadModalOpen, setUploadModalOpen] = useState(false);
    const [createCourseOpen, setCreateCourseOpen] = useState(false);
    const { toast } = useToast();

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    const loadNotes = async () => {
        if (!session) return;

        setLoading(true);
        setError(null);
        try {
            // Fetch this user's notes.
            const { data, error: supabaseError } = await supabase
                .from("notes")
                .select("*")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false });

            if (supabaseError) {
                console.error("Supabase error loading notes:", supabaseError);
                throw supabaseError;
            }

            const loadedNotes = data || [];
            setNotes(loadedNotes);

            // Load courses (via API, service-role) and per-note completion
            // (from note_progress) to compute each course's progress ratio.
            const [coursesData, progressRes] = await Promise.all([
                fetchCourses(session.access_token).catch(() => [] as Course[]),
                supabase
                    .from("note_progress")
                    .select("note_id, status")
                    .eq("user_id", session.user.id),
            ]);

            const completedNoteIds = new Set(
                (progressRes.data || [])
                    .filter((p: { status: string }) => p.status === "completed")
                    .map((p: { note_id: string }) => p.note_id)
            );

            const perCourse: Record<string, { count: number; completed: number }> = {};
            for (const n of loadedNotes) {
                if (!n.course_id) continue;
                const bucket = perCourse[n.course_id] || (perCourse[n.course_id] = { count: 0, completed: 0 });
                bucket.count++;
                if (completedNoteIds.has(n.id)) bucket.completed++;
            }

            const stats: Record<string, { count: number; progress: number }> = {};
            for (const c of coursesData) {
                if (!c.id) continue;
                const b = perCourse[c.id] || { count: 0, completed: 0 };
                stats[c.id] = {
                    count: b.count,
                    progress: b.count > 0 ? Math.round((b.completed / b.count) * 100) : 0,
                };
            }

            setCourses(coursesData);
            setCourseStats(stats);
            notesCache = { userId: session.user.id, notes: loadedNotes, courses: coursesData, courseStats: stats };
        } catch (err) {
            console.error("❌ Error loading notes:", err);
            setError("Unable to load your notes");
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    };

    // User-triggered refresh (keeps the current content visible while it runs).
    const handleRefresh = async () => {
        if (refreshing) return;
        setRefreshing(true);
        await loadNotes();
        setRefreshing(false);
    };

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        // Only fetch on first load / when there's no cached data for this user.
        // Back-navigation reuses the cache; use Refresh to force a re-fetch.
        if (session && !hasLoaded) {
            loadNotes();
        }
    }, [session, authLoading, navigate, hasLoaded]);

    const assignNoteToCourse = async (noteId: string, courseId: string) => {
        if (!session) return;
        try {
            const { data, error: updateError } = await supabase
                .from("notes")
                .update({ course_id: courseId })
                .eq("id", noteId)
                .eq("user_id", session.user.id)
                .select("id");

            if (updateError) throw updateError;

            if (!data || data.length === 0) {
                // RLS silently blocked the update (no UPDATE policy on notes).
                toast({
                    variant: "destructive",
                    title: "Couldn't move note",
                    description: "The update was blocked. Add an UPDATE policy on the notes table.",
                });
                return;
            }

            toast({ title: "Note moved", description: "Added to the course." });
            loadNotes();
        } catch (err: any) {
            console.error("Failed to assign note to course:", err);
            toast({
                variant: "destructive",
                title: "Couldn't move note",
                description: err.message || "Please try again.",
            });
        }
    };

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    if (authLoading || (loading && !hasLoaded)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName || "Loading..."} activeItem="home" onSignOut={handleSignOut} />
                <div className="flex-1 overflow-y-auto">
                    <div className="max-w-4xl mx-auto p-6 md:p-10 space-y-10 animate-pulse">
                        <div className="mb-4">
                            <div className="h-8 w-40 bg-muted rounded-lg"></div>
                        </div>
                        <div className="h-40 bg-card rounded-3xl w-full border border-border"></div>
                        <div className="space-y-4">
                            <div className="h-4 w-32 bg-card rounded"></div>
                            <div className="h-24 bg-card rounded-2xl w-full"></div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
                        <h2 className="text-xl font-semibold mb-2">Unable to load notes</h2>
                        <p className="text-muted-foreground text-sm mb-6">There was a problem fetching your notes.</p>
                        <button
                            onClick={loadNotes}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    const looseNotes = notes.filter((n) => !n.course_id);
    const showBigEmptyState = notes.length === 0 && courses.length === 0;

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar
                userName={userName}
                activeItem="notes"
                onSignOut={handleSignOut}
            />

            <div className="flex-1 overflow-y-auto">
                <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Your Notes</h1>
                            <p className="text-muted-foreground text-sm">Upload PDFs and learn interactively</p>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                            <button
                                onClick={handleRefresh}
                                disabled={refreshing}
                                className="border border-border hover:bg-muted text-muted-foreground hover:text-foreground p-2.5 rounded-xl transition-all disabled:opacity-50"
                                aria-label="Refresh"
                                title="Refresh"
                            >
                                <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
                            </button>
                            <button
                                onClick={() => setCreateCourseOpen(true)}
                                className="border border-border hover:bg-muted text-foreground px-4 py-2.5 rounded-xl font-medium transition-all flex items-center gap-2"
                            >
                                <FolderPlus className="w-4 h-4" /> New Course
                            </button>
                            <button
                                onClick={() => setUploadModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-[1.02] flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Upload Note
                            </button>
                        </div>
                    </div>

                    {showBigEmptyState ? (
                        /* Empty State — no notes and no courses at all */
                        <div className="rounded-3xl p-10 border border-border bg-card text-center">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <FileSearch className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No notes yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Upload your first PDF to start learning interactively with TECHCESS
                            </p>
                            <button
                                onClick={() => setUploadModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-all hover:scale-[1.02] inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Upload Your First Note
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Courses grid — each card opens its own route */}
                            {courses.length > 0 && (
                                <section className="space-y-4">
                                    <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                                        Courses
                                    </h2>
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {courses.map((c) => (
                                            <NoteCourseCard
                                                key={c.id}
                                                code={c.course_code}
                                                name={c.name}
                                                noteCount={courseStats[c.id!]?.count || 0}
                                                progress={courseStats[c.id!]?.progress || 0}
                                                onClick={() => navigate(`/notes/course/${c.id}`)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Uncategorized notes (notes not assigned to any course) */}
                            {looseNotes.length > 0 && (
                                <section className="space-y-4">
                                    {courses.length > 0 && (
                                        <h2 className="text-xs font-bold tracking-widest uppercase text-muted-foreground">
                                            Uncategorized Notes
                                        </h2>
                                    )}
                                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                                        {looseNotes.map((note) => (
                                            <NoteCard
                                                key={note.id}
                                                note={note}
                                                courses={courses}
                                                onAssign={(courseId) => assignNoteToCourse(note.id, courseId)}
                                            />
                                        ))}
                                    </div>
                                </section>
                            )}
                        </>
                    )}
                </main>
            </div>

            <NoteUploadModal
                isOpen={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onUploadSuccess={loadNotes}
            />

            <CreateCourseDialog
                isOpen={createCourseOpen}
                onClose={() => setCreateCourseOpen(false)}
                onCreated={() => {
                    setCreateCourseOpen(false);
                    toast({ title: "Course created", description: "Your new course is ready." });
                    loadNotes();
                }}
            />
        </div>
    );
}
