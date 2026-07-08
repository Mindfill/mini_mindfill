import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/lib/supabase";
import AppSidebar from "@/components/sidebar/AppSidebar";
import PdfViewer from "@/components/notes/PdfViewer";
import { ArrowLeft, ExternalLink, MessageSquare, X } from "lucide-react";

export default function NoteReader() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();
    const params = useParams<{ noteId: string }>();
    const noteId = params.noteId || "";

    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [noteTitle, setNoteTitle] = useState("Note");
    const [fileUrl, setFileUrl] = useState<string | null>(null);

    const userName = user?.user_metadata?.full_name || user?.email || "User";

    const loadNote = async () => {
        if (!session || !noteId) return;
        setLoading(true);
        setError(null);
        try {
            const { data, error: noteError } = await supabase
                .from("notes")
                .select("title, file_url")
                .eq("id", noteId)
                .single();

            if (noteError) throw noteError;
            setNoteTitle(data.title);
            setFileUrl(data.file_url ?? null);
        } catch (err) {
            console.error("Failed to load note:", err);
            setError("Could not load this note");
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
        if (session) loadNote();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, authLoading, navigate, noteId]);

    useEffect(() => {
        document.title = `${noteTitle} | TECHCESS Reader`;
    }, [noteTitle]);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    const goBack = () => {
        if (window.history.length > 1) window.history.back();
        else navigate("/notes");
    };

    if (authLoading || (loading && !hasLoaded && !error)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName || "Loading..."} activeItem="notes" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground animate-pulse">
                        Loading Note...
                    </p>
                </div>
            </div>
        );
    }

    if (error || !fileUrl) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />
                <div className="flex-1 flex flex-col items-center justify-center bg-background p-6 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-6">
                        <X className="w-8 h-8 text-red-500" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Can't open this note</h2>
                    <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
                        {error || "This note doesn't have a viewable file."}
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={loadNote}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Retry
                        </button>
                        <button
                            onClick={goBack}
                            className="bg-muted text-foreground hover:bg-muted/80 px-8 py-3 rounded-full font-bold text-sm transition-all"
                        >
                            Back
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar userName={userName} activeItem="notes" onSignOut={handleSignOut} />

            <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-background">
                {/* Header */}
                <header className="bg-background/40 backdrop-blur-xl border-b border-border px-4 md:px-6 py-4 flex justify-between items-center gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                        <button
                            onClick={goBack}
                            className="text-muted-foreground hover:text-foreground transition-all flex items-center gap-1 flex-shrink-0"
                            aria-label="Back"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="hidden sm:inline text-xs font-bold tracking-widest uppercase">Back</span>
                        </button>
                        <div className="h-4 w-px bg-border flex-shrink-0" />
                        <h1 className="text-sm font-bold text-foreground tracking-tight truncate min-w-0">
                            {noteTitle}
                        </h1>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                            onClick={() => navigate(`/notes/${noteId}`)}
                            className="text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-full px-4 py-2 transition-colors flex items-center gap-2 text-[10px] font-bold tracking-widest uppercase"
                            title="Open interactive chat"
                        >
                            <MessageSquare className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Learn</span>
                        </button>
                        <a
                            href={fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground border border-border hover:border-primary/40 rounded-full p-2 transition-colors"
                            aria-label="Open in new tab"
                            title="Open in new tab"
                        >
                            <ExternalLink className="w-4 h-4" />
                        </a>
                    </div>
                </header>

                {/* PDF viewer (pdf.js — renders on mobile too) */}
                <div className="flex-1 min-h-0 bg-muted/30">
                    <PdfViewer url={fileUrl} />
                </div>
            </div>
        </div>
    );
}
