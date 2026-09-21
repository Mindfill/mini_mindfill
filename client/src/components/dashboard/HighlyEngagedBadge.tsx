import { Flame } from "lucide-react";

/**
 * Sits next to a student's name on the admin and school views.
 *
 * "Highly engaged" here means one specific, checkable thing: the student has
 * opened at least one session outside school hours this week — early morning,
 * evening, or the weekend. That's study nobody scheduled for them.
 *
 * The title spells that out, because a bare flame next to a name in a school
 * report is the kind of label people read a lot into.
 */
export default function HighlyEngagedBadge() {
    return (
        <span
            title="Has studied outside school hours this week"
            className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-orange-500/10 text-orange-700 dark:text-orange-400 align-middle"
        >
            <Flame className="w-3 h-3" aria-hidden="true" />
            Engaged
        </span>
    );
}
