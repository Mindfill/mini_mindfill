import { useLocation } from "wouter";
import { FileText } from "lucide-react";
import type { Note, Course } from "@/lib/api";

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface NoteCardProps {
    note: Note;
    /** When provided, shows an "Add to course" selector on the card. */
    courses?: Course[];
    onAssign?: (courseId: string) => void;
}

/** A single note tile that navigates to the note chat on click. */
export default function NoteCard({ note, courses, onAssign }: NoteCardProps) {
    const [, navigate] = useLocation();
    const showAssign = !!onAssign && !!courses && courses.length > 0;

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

                {/* Assign to a course (stops propagation so it doesn't open the note) */}
                {showAssign && (
                    <div onClick={(e) => e.stopPropagation()}>
                        <select
                            value=""
                            onChange={(e) => {
                                if (e.target.value) onAssign!(e.target.value);
                            }}
                            className="w-full text-xs bg-muted border border-border rounded-lg px-2 py-2 text-foreground/80 focus:outline-none focus:border-primary/50 cursor-pointer"
                        >
                            <option value="" disabled>
                                Add to course…
                            </option>
                            {courses!.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.course_code ? `${c.course_code} — ${c.name}` : c.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
            </div>
        </div>
    );
}
