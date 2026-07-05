import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { supabase } from "@/lib/supabase";
import { Note, Course, fetchCourses } from "@/lib/api";
import { Plus, FileSearch } from "lucide-react";
import NoteUploadModal from "@/components/notes/NoteUploadModal";
import NoteCourseCard from "@/components/notes/NoteCourseCard";
import NoteCard from "@/components/notes/NoteCard";

export default function NotesDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [courses, setCourses] = useState<Course[]>([]);
    const [courseStats, setCourseStats] = useState<Record<string, { count: number; progress: number }>>({});
    const [uploadModalOpen, setUploadModalOpen] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    const loadNotes = async () => {
        if (!session) return;

        console.log("🔄 Loading notes for user:", session.user.id);
        console.log("🔑 Full session info:", {
            userId: session.user.id,
            email: session.user.email
        });
        setLoading(true);
        setError(null);
        try {
            // First, let's fetch ALL notes to check what's in the table!
            const { data: allNotes, error: allNotesError } = await supabase
                .from("notes")
                .select("*")
                .order("created_at", { ascending: false });

            console.log("📋 ALL notes in the table:", allNotes);
            console.log("📊 Total notes in table:", allNotes?.length);
            if (allNotes && allNotes.length > 0) {
                console.log("📝 First note's user_id:", allNotes[0].user_id);
            }

            if (allNotesError) {
                console.error("❌ Supabase error loading ALL notes:", allNotesError);
            }

            // Now fetch notes for the current user
            const { data, error: supabaseError } = await supabase
                .from("notes")
                .select("*")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false });

            if (supabaseError) {
                console.error("❌ Supabase error loading notes:", supabaseError);
                throw supabaseError;
            }

            console.log("✅ Notes loaded from Supabase:", data);
            console.log("📊 Number of notes:", data?.length);
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
        } catch (err) {
            console.error("❌ Error loading notes:", err);
            setError("Unable to load your notes");
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    };

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }

        if (session) {
            loadNotes();
        }
    }, [session, authLoading, navigate]);

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
                        <button
                            onClick={() => setUploadModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-[1.02] flex items-center gap-2 flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Upload Note
                        </button>
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
                                            <NoteCard key={note.id} note={note} />
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
        </div>
    );
}
