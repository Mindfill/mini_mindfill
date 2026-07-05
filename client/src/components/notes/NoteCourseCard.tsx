import { Folder } from "lucide-react";

interface NoteCourseCardProps {
    code?: string;
    name: string;
    noteCount: number;
    /** 0–100 */
    progress: number;
    onClick?: () => void;
}

/**
 * Course card for the Notes page: folder icon, course code + name, note count,
 * and a completion progress bar. Themed with the app's primary color.
 */
export default function NoteCourseCard({ code, name, noteCount, progress, onClick }: NoteCourseCardProps) {
    const heading = code || name;
    const subtitle = code ? name : undefined;
    const pct = Math.max(0, Math.min(100, Math.round(progress)));

    return (
        <button
            onClick={onClick}
            className="group text-left p-6 rounded-3xl border border-border bg-card hover:shadow-lg hover:scale-[1.02] hover:border-primary/30 transition-all duration-300 flex flex-col gap-4"
        >
            {/* Icon */}
            <div className="p-3 rounded-2xl bg-primary/10 w-fit">
                <Folder className="w-7 h-7 text-primary" />
            </div>

            {/* Title */}
            <div>
                <h3 className="font-bold text-lg text-foreground leading-tight truncate">{heading}</h3>
                {subtitle && <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>}
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
    );
}
