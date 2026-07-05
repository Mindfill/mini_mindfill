import { useLocation } from "wouter";
import { FileText } from "lucide-react";
import type { Note } from "@/lib/api";

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** A single note tile that navigates to the note chat on click. */
export default function NoteCard({ note }: { note: Note }) {
    const [, navigate] = useLocation();

    return (
        <div
            onClick={() => navigate(`/notes/${note.id}`)}
            className="group cursor-pointer p-6 rounded-3xl border border-border bg-card hover:bg-card transition-all hover:shadow-lg hover:scale-[1.02] duration-300"
        >
            <div className="flex flex-col gap-4">
                {/* Icon */}
                <div className="p-4 rounded-2xl bg-primary/10 w-fit">
                    <FileText className="w-8 h-8 text-primary" />
                </div>

                {/* Content */}
                <div>
                    <h3 className="font-bold text-xl mb-1 truncate">{note.title}</h3>
                    <p className="text-muted-foreground text-sm mb-2 truncate">{note.file_name}</p>
                    <div className="space-y-2">
                        <p className="text-xs text-muted-foreground">{formatFileSize(note.file_size_bytes)}</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
