import { ListChecks } from "lucide-react";
import type { PracticeSummary } from "@/lib/secondaryApi";

/**
 * Practice-quiz scores over the last 30 days — on the student's own dashboard
 * (with a "Practice" button) and, read-only, in the parent/school drill-down.
 *
 * Deliberately separate from Strengths / Needs Work: those come from how
 * deeply the student understood lessons with the tutor; this is how they score
 * when they test themselves, and the two can honestly disagree.
 */
export default function PracticeSummaryCard({
    summary,
    onPractice,
    subject = "you",
}: {
    summary: PracticeSummary | null | undefined;
    /** Student view only. */
    onPractice?: () => void;
    /** "you" on the student's own dashboard, their first name for an adult. */
    subject?: string;
}) {
    const hasData = !!summary && summary.answered > 0;
    const pct = summary?.accuracy_percent ?? null;
    const tone =
        pct === null
            ? ""
            : pct >= 70
              ? "text-emerald-700 dark:text-emerald-400"
              : pct >= 50
                ? "text-amber-700 dark:text-amber-400"
                : "text-red-700 dark:text-red-400";

    return (
        <div className="glass-panel rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                    <ListChecks className="w-4 h-4 text-primary" /> Practice
                </h3>
                {onPractice && (
                    <button
                        onClick={onPractice}
                        className="min-h-[40px] px-4 rounded-full bg-primary text-primary-foreground text-sm font-medium"
                    >
                        Practice
                    </button>
                )}
            </div>

            {!hasData ? (
                <p className="text-muted-foreground text-sm">
                    {subject === "you"
                        ? "Quiz yourself on any chapter — your scores show up here."
                        : `${subject} hasn't taken a practice quiz yet.`}
                </p>
            ) : (
                <>
                    <dl className="grid grid-cols-3 gap-3">
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Accuracy</dt>
                            <dd className={`text-lg font-semibold ${tone}`}>{pct}%</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Answered</dt>
                            <dd className="text-lg font-semibold">{summary!.answered}</dd>
                        </div>
                        <div>
                            <dt className="text-[11px] uppercase tracking-wider text-muted-foreground">Quizzes · 7d</dt>
                            <dd className="text-lg font-semibold">{summary!.quizzes_this_week}</dd>
                        </div>
                    </dl>
                    {/* The five most recently practiced (the list arrives newest first). */}
                    <div className="space-y-3">
                        {summary!.by_chapter.slice(0, 5).map((c) => (
                            <div key={c.chapter_id}>
                                <div className="flex justify-between gap-3 text-sm mb-1">
                                    <span className="text-muted-foreground truncate min-w-0">{c.chapter_title}</span>
                                    <span className="text-muted-foreground shrink-0">
                                        {c.correct}/{c.answered}
                                    </span>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all duration-700 ${
                                            c.accuracy_percent >= 70 ? "bg-emerald-500" : c.accuracy_percent >= 50 ? "bg-amber-500" : "bg-red-500"
                                        }`}
                                        style={{ width: `${c.accuracy_percent}%` }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                    {summary!.weakest_chapter && summary!.weakest_chapter.accuracy_percent < 70 && (
                        <p className="text-sm">
                            Lowest score: <span className="font-semibold">{summary!.weakest_chapter.chapter_title}</span> (
                            {summary!.weakest_chapter.accuracy_percent}%)
                        </p>
                    )}
                    <p className="text-xs text-muted-foreground">Last {summary!.window_days} days</p>
                </>
            )}
        </div>
    );
}
