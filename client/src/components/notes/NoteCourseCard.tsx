import { Folder, Trash2 } from "lucide-react";
import {
    AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
    AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface NoteCourseCardProps {
    code?: string;
    name: string;
    noteCount: number;
    /** 0–100 */
    progress: number;
    onClick?: () => void;
    /** When provided, shows a delete affordance (with confirmation) on the card. */
    onDelete?: () => void;
}

/**
 * Course card for the Notes page: folder icon, course code + name, note count,
 * and a completion progress bar. Themed with the app's primary color.
 */
export default function NoteCourseCard({ code, name, noteCount, progress, onClick, onDelete }: NoteCourseCardProps) {
    const heading = code || name;
    const subtitle = code ? name : undefined;
    const pct = Math.max(0, Math.min(100, Math.round(progress)));

    return (
        <div className="relative">
            <button
                onClick={onClick}
                className="group w-full min-w-0 text-left p-6 rounded-3xl border border-border bg-card hover:shadow-lg hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 flex flex-col gap-4"
            >
                {/* Icon */}
                <div className="p-3 rounded-2xl bg-primary/10 w-fit">
                    <Folder className="w-7 h-7 text-primary" />
                </div>

                {/* Title */}
                <div className="min-w-0 w-full pr-8">
                    <h3 className="font-bold text-lg text-foreground leading-tight break-words [overflow-wrap:anywhere]">{heading}</h3>
                    {subtitle && <p className="text-sm text-muted-foreground mt-0.5 break-words [overflow-wrap:anywhere]">{subtitle}</p>}
                </div>

                {/* Stats + progress (pinned to bottom for even card heights) */}
                <div className="mt-auto space-y-3">
                    <p className="text-xs text-muted-foreground">
                        {noteCount} note{noteCount !== 1 ? "s" : ""}
                    </p>
                    <div>
                        <div className="flex justify-between items-center mb-1.5">
                            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                                Progress
                            </span>
                            <span className="text-[11px] font-bold text-primary">{pct}%</span>
                        </div>
                        <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                                style={{ width: `${pct}%` }}
                            />
                        </div>
                    </div>
                </div>
            </button>

            {/* Delete — sibling of the card button (not nested) */}
            {onDelete && (
                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <button
                            onClick={(e) => e.stopPropagation()}
                            className="absolute top-4 right-4 p-2 rounded-lg text-muted-foreground/60 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                            aria-label="Delete course"
                            title="Delete course"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                        <AlertDialogHeader>
                            <AlertDialogTitle>Delete this course?</AlertDialogTitle>
                            <AlertDialogDescription>
                                “{heading}” will be removed. Its notes aren't deleted — they move back to your
                                uncategorized notes.
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={onDelete} className="bg-red-500 hover:bg-red-600 text-white">
                                Delete course
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            )}
        </div>
    );
}
