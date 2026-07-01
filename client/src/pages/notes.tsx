import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { supabase } from "@/lib/supabase";
import { Note } from "@/lib/api";
import { FileText, Plus, ArrowRight, FileSearch, BookOpen } from "lucide-react";
import NoteUploadModal from "@/components/notes/NoteUploadModal";

export default function NotesDashboard() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [notes, setNotes] = useState<Note[]>([]);
    const [uploadModalOpen, setUploadModalOpen] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    const loadNotes = async () => {
        if (!session) return;

        setLoading(true);
        setError(null);
        try {
            const { data, error: supabaseError } = await supabase
                .from("notes")
                .select("*")
                .eq("user_id", session.user.id)
                .order("created_at", { ascending: false });

            if (supabaseError) {
                throw supabaseError;
            }

            setNotes(data || []);
        } catch (err) {
            console.error(err);
            setError("Unable to load your notes");
        } finally {
            setLoading(false);
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

    const formatFileSize = (bytes: number) => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    if (authLoading || loading) {
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

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar
                userName={userName}
                activeItem="home"
                onSignOut={handleSignOut}
            />

            <div className="flex-1 overflow-y-auto">
                <main className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">

                    {/* Header */}
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Your Notes</h1>
                            <p className="text-muted-foreground text-sm">Upload PDFs and learn interactively</p>
                        </div>
                        <button
                            onClick={() => setUploadModalOpen(true)}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 rounded-xl font-medium transition-all hover:scale-[1.02] flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" /> Upload Note
                        </button>
                    </div>

                    {/* Notes Grid */}
                    {notes.length > 0 ? (
                        <div className="grid gap-4 md:grid-cols-2">
                            {notes.map((note) => (
                                <div
                                    key={note.id}
                                    className="group p-5 rounded-2xl border border-border bg-card hover:bg-card transition-all hover:shadow-sm"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 rounded-xl bg-primary/10">
                                                <FileText className="w-5 h-5 text-primary" />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-lg">{note.title}</h3>
                                                <p className="text-muted-foreground text-xs mt-1">
                                                    {note.file_name} • {formatFileSize(note.file_size_bytes)}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => navigate(`/notes/${note.id}`)}
                                            className="p-2 rounded-lg text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
                                        >
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="mt-4 flex items-center justify-between">
                                        <button
                                            onClick={() => navigate(`/notes/${note.id}`)}
                                            className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
                                        >
                                            Open Note
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        /* Empty State */
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
