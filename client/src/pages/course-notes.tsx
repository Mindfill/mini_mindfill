import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import { Note, Course, fetchCourses } from "@/lib/api";
import AppSidebar from "@/components/sidebar/AppSidebar";
import NoteUploadModal from "@/components/notes/NoteUploadModal";
import NoteCard from "@/components/notes/NoteCard";
import { useToast } from "@/hooks/use-toast";
import { Plus, FileSearch, ArrowLeft } from "lucide-react";

export default function CourseNotes() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const params = useParams<{ courseId: string }>();
    const courseId = params.courseId || "";

    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [course, setCourse] = useState<Course | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const { toast } = useToast();

    const removeNoteFromCourse = async (noteId: string) => {
        if (!session) return;
        try {
            const { data, error: updateError } = await supabase
                .from("notes")
                .update({ course_id: null })
                .eq("id", noteId)
                .eq("user_id", session.user.id)
                .select("id");

            if (updateError) throw updateError;

            if (!data || data.length === 0) {
                // RLS silently blocked the update (no UPDATE policy on notes).
                toast({
                    variant: "destructive",
                    title: "Couldn't remove note",
                    description: "The update was blocked. Add an UPDATE policy on the notes table.",
                });
                return;
            }

            toast({ title: "Note removed", description: "Moved back to uncategorized." });
            loadData();
        } catch (err: any) {
            console.error("Failed to remove note from course:", err);
            toast({
                variant: "destructive",
                title: "Couldn't remove note",
                description: err.message || "Please try again.",
            });
        }
    };

    const loadData = async () => {
        if (!session || !courseId) return;

        setLoading(true);
        setError(null);
        try {
            const [coursesData, notesRes] = await Promise.all([
                fetchCourses(session.access_token).catch(() => [] as Course[]),
                supabase
                    .from("notes")
                    .select("*")
                    .eq("user_id", session.user.id)
                    .eq("course_id", courseId)
                    .order("created_at", { ascending: false }),
            ]);

            if (notesRes.error) throw notesRes.error;

            setCourse(coursesData.find((c) => c.id === courseId) || null);
            setNotes(notesRes.data || []);
        } catch (err) {
            console.error("Failed to load course notes:", err);
            setError("Unable to load this course");
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
        if (session) loadData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, authLoading, navigate, courseId]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    if (authLoading || (loading && !hasLoaded)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName || "Loading..."} activeItem="notes" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground animate-pulse">
                        Loading Course...
                    </p>
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
                        <h2 className="text-xl font-semibold mb-2">Unable to load course</h2>
                        <p className="text-muted-foreground text-sm mb-6">There was a problem fetching this course.</p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={loadData}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                            >
                                Retry
                            </button>
                            <button
                                onClick={() => navigate("/notes")}
                                className="bg-muted text-foreground hover:bg-muted/80 px-6 py-2 rounded-xl font-medium transition-colors"
                            >
                                Back to Notes
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const heading = course?.course_code || course?.name || "Course";
    const subtitle = course?.course_code ? course?.name : "Course notes";

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />

            <div className="flex-1 overflow-y-auto">
                <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div>
                            <button
                                onClick={() => navigate("/notes")}
                                className="text-muted-foreground hover:text-foreground transition-all text-xs font-bold tracking-widest uppercase flex items-center gap-1 mb-2"
                            >
                                <ArrowLeft className="w-3 h-3" /> All Notes
                            </button>
                            <h1 className="text-2xl font-semibold tracking-tight">{heading}</h1>
                            <p className="text-muted-foreground text-sm">{subtitle}</p>
                        </div>
                        <button
                            onClick={() => setUploadModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-[1.02] flex items-center gap-2 flex-shrink-0"
                        >
                            <Plus className="w-4 h-4" /> Upload Note
                        </button>
                    </div>

                    {/* Notes grid */}
                    {notes.length > 0 ? (
                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {notes.map((note) => (
                                <NoteCard
                                    key={note.id}
                                    note={note}
                                    onRemoveFromCourse={() => removeNoteFromCourse(note.id)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="rounded-3xl p-10 border border-border bg-card text-center">
                            <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                                <FileSearch className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="text-xl font-semibold mb-2">No notes in this course yet</h3>
                            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                                Upload a note and assign it to this course to get started.
                            </p>
                            <button
                                onClick={() => setUploadModalOpen(true)}
                                className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-3 rounded-xl font-medium transition-all hover:scale-[1.02] inline-flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" /> Upload Note
                            </button>
                        </div>
                    )}
                </main>
            </div>

            <NoteUploadModal
                isOpen={uploadModalOpen}
                onClose={() => setUploadModalOpen(false)}
                onUploadSuccess={loadData}
                defaultCourseId={courseId}
            />
        </div>
    );
}
