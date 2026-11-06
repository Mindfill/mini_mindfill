import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { UsageAnalytics, UsageScope, UsageStudent, UsageStudentWeek } from "@/lib/usageAnalytics";

/**
 * Every student's own figures for the week the usage panel is showing.
 *
 * Lives inside UsageAnalyticsPanel rather than beside it, so the panel's week
 * arrows move this too — the chart and the table can never disagree about
 * which week they describe. Read-only; a row only opens the existing student
 * sheet where the dashboard has one (school, parent).
 *
 * Students who did nothing that week are listed, not dropped: "who didn't
 * study" is half the reason a school or parent opens this.
 */

type SortKey =
    | "name"
    | "sessions"
    | "lessons_completed"
    | "revisit_sessions"
    | "outside_hours_sessions"
    | "days_active"
    | "study_minutes"
    | "tutor_exchanges"
    | "practice_quizzes"
    | "last_session_at";

const COLUMNS: { key: SortKey; label: string; title: string }[] = [
    { key: "sessions", label: "Sessions", title: "Lesson sessions started in the week" },
    { key: "lessons_completed", label: "Finished", title: "New lessons completed (first attempts)" },
    { key: "revisit_sessions", label: "Revisits", title: "Lessons reopened after already finishing them" },
    { key: "outside_hours_sessions", label: "Out of hours", title: "Sessions started before 8am, after 3pm, or at the weekend" },
    { key: "days_active", label: "Days", title: "Days with at least one session" },
    { key: "study_minutes", label: "Study time", title: "Active time on lesson screens" },
    { key: "tutor_exchanges", label: "Tutor msgs", title: "Messages exchanged with the tutor" },
    { key: "practice_quizzes", label: "Quizzes", title: "Practice quizzes finished" },
    { key: "last_session_at", label: "Last session", title: "Most recent session start in the week" },
];

const PAGE = 25;

const EMPTY_WEEK: UsageStudentWeek = {
    sessions: 0,
    lessons_completed: 0,
    revisit_sessions: 0,
    outside_hours_sessions: 0,
    tutor_exchanges: 0,
    days_active: 0,
    study_minutes: 0,
    practice_quizzes: 0,
    last_session_at: null,
};

function weekOf(s: UsageStudent): UsageStudentWeek {
    return s.week ?? EMPTY_WEEK;
}

function formatMinutes(min: number | null): string {
    if (min === null) return "—";
    if (min < 60) return `${min}m`;
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
}

/** In the student's clock, like every other figure on the panel. */
function formatLast(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleString(undefined, {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "Africa/Lagos",
    });
}

function cell(week: UsageStudentWeek, key: SortKey): string {
    switch (key) {
        case "study_minutes":
            return formatMinutes(week.study_minutes);
        case "last_session_at":
            return formatLast(week.last_session_at);
        case "practice_quizzes":
            return week.practice_quizzes === null ? "—" : String(week.practice_quizzes);
        case "name":
            return "";
        default:
            return String(week[key]);
    }
}

/** Nulls (a failed read) always sink to the bottom, whichever direction. */
function sortValue(s: UsageStudent, key: SortKey): number | string | null {
    if (key === "name") return s.student_name.toLowerCase();
    const v = weekOf(s)[key];
    if (key === "last_session_at") return v ? new Date(v as string).getTime() : null;
    return v as number | null;
}

export default function StudentWeekTable({
    data,
    scope,
    onOpenStudent,
}: {
    data: UsageAnalytics;
    scope: UsageScope;
    onOpenStudent?: (studentId: string) => void;
}) {
    const [sortKey, setSortKey] = useState<SortKey>("sessions");
    const [desc, setDesc] = useState(true);
    const [query, setQuery] = useState("");
    const [showAll, setShowAll] = useState(false);

    const students = data.students ?? [];
    const searchable = students.length > 8;

    const rows = useMemo(() => {
        const q = query.trim().toLowerCase();
        const filtered = q
            ? students.filter(
                  (s) => s.student_name.toLowerCase().includes(q) || s.class_level.toLowerCase().includes(q),
              )
            : students;
        return [...filtered].sort((a, b) => {
            const av = sortValue(a, sortKey);
            const bv = sortValue(b, sortKey);
            if (av === null && bv !== null) return 1;
            if (bv === null && av !== null) return -1;
            if (av !== null && bv !== null && av !== bv) {
                const cmp = av < bv ? -1 : 1;
                return desc ? -cmp : cmp;
            }
            return a.student_name.localeCompare(b.student_name);
        });
    }, [students, query, sortKey, desc]);

    const visible = showAll ? rows : rows.slice(0, PAGE);
    const studied = students.filter((s) => weekOf(s).sessions > 0).length;
    const noun = scope === "parent" ? "child" : "student";
    const nouns = scope === "parent" ? "children" : "students";

    const toggleSort = (key: SortKey) => {
        if (key === sortKey) {
            setDesc((d) => !d);
        } else {
            setSortKey(key);
            // Names read naturally A→Z; every figure reads naturally high→low.
            setDesc(key !== "name");
        }
    };

    if (students.length === 0) return null;

    return (
        <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="p-6 pb-4 space-y-3">
                <div>
                    <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                        {scope === "parent" ? "Each child" : "Each student"} · {data.week.label.toLowerCase()}
                    </h4>
                    <p className="text-xs text-muted-foreground mt-1">
                        {studied} of {students.length} {students.length === 1 ? noun : nouns} had at least one session. Same week and definitions as the chart above.
                    </p>
                </div>

                {(searchable || students.length > 1) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {searchable && (
                            <label className="relative flex-1 min-w-[180px] max-w-xs">
                                <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                                <input
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    placeholder="Search name or class"
                                    aria-label="Search students"
                                    className="w-full h-9 pl-8 pr-3 rounded-xl bg-background/60 border border-border/60 text-base sm:text-sm outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                                />
                            </label>
                        )}
                        {/* Phones get no clickable headers, so sorting lives here. */}
                        <select
                            value={`${sortKey}:${desc ? "desc" : "asc"}`}
                            onChange={(e) => {
                                const [k, dir] = e.target.value.split(":");
                                setSortKey(k as SortKey);
                                setDesc(dir === "desc");
                            }}
                            aria-label="Sort by"
                            className="md:hidden h-9 px-2 rounded-xl bg-background/60 border border-border/60 text-base sm:text-sm"
                        >
                            <option value="sessions:desc">Most sessions</option>
                            <option value="sessions:asc">Fewest sessions</option>
                            <option value="study_minutes:desc">Most study time</option>
                            <option value="lessons_completed:desc">Most lessons finished</option>
                            <option value="last_session_at:desc">Most recent</option>
                            <option value="name:asc">Name A–Z</option>
                        </select>
                    </div>
                )}
            </div>

            {rows.length === 0 ? (
                <p className="text-sm text-muted-foreground px-6 pb-6">No {nouns} match “{query}”.</p>
            ) : (
                <>
                    {/* Desktop: sortable table */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-muted-foreground text-xs uppercase tracking-wider border-b border-border/50">
                                    <SortHeader label="Name" active={sortKey === "name"} desc={desc} onClick={() => toggleSort("name")} className="pl-6" />
                                    {COLUMNS.map((c) => (
                                        <SortHeader
                                            key={c.key}
                                            label={c.label}
                                            title={c.title}
                                            active={sortKey === c.key}
                                            desc={desc}
                                            onClick={() => toggleSort(c.key)}
                                        />
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {visible.map((s) => {
                                    const week = weekOf(s);
                                    const idle = week.sessions === 0;
                                    return (
                                        <tr
                                            key={s.student_id}
                                            {...rowProps(s, onOpenStudent)}
                                            className={`border-b border-border/30 last:border-0 ${
                                                onOpenStudent ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none transition-colors" : ""
                                            }`}
                                        >
                                            <td className="pl-6 pr-3 py-3">
                                                <span className="block font-medium whitespace-nowrap">{s.student_name}</span>
                                                {s.class_level && (
                                                    <span className="block text-xs text-muted-foreground">{s.class_level}</span>
                                                )}
                                            </td>
                                            {COLUMNS.map((c) => (
                                                <td
                                                    key={c.key}
                                                    className={`px-3 py-3 tabular-nums whitespace-nowrap ${
                                                        idle ? "text-muted-foreground/60" : c.key === "sessions" ? "font-semibold" : "text-muted-foreground"
                                                    }`}
                                                >
                                                    {cell(week, c.key)}
                                                </td>
                                            ))}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    {/* Phones: one card per student */}
                    <ul className="md:hidden px-4 pb-2 space-y-3">
                        {visible.map((s) => {
                            const week = weekOf(s);
                            return (
                                <li
                                    key={s.student_id}
                                    {...rowProps(s, onOpenStudent)}
                                    className={`rounded-xl border border-border/40 p-4 ${
                                        week.sessions === 0 ? "opacity-70" : ""
                                    } ${onOpenStudent ? "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none" : ""}`}
                                >
                                    <div className="flex items-baseline justify-between gap-3 mb-3">
                                        <span className="min-w-0">
                                            <span className="block font-medium truncate">{s.student_name}</span>
                                            {s.class_level && (
                                                <span className="block text-xs text-muted-foreground">{s.class_level}</span>
                                            )}
                                        </span>
                                        <span className="shrink-0 text-sm">
                                            <span className="text-lg font-bold tabular-nums">{week.sessions}</span>{" "}
                                            <span className="text-muted-foreground text-xs">{week.sessions === 1 ? "session" : "sessions"}</span>
                                        </span>
                                    </div>
                                    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                                        {COLUMNS.filter((c) => c.key !== "sessions").map((c) => (
                                            <div key={c.key} className="flex justify-between gap-2 min-w-0">
                                                <dt className="text-muted-foreground truncate">{c.label}</dt>
                                                <dd className="tabular-nums font-medium whitespace-nowrap">{cell(week, c.key)}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </li>
                            );
                        })}
                    </ul>

                    {rows.length > PAGE && (
                        <div className="px-6 py-4 border-t border-border/30">
                            <button
                                onClick={() => setShowAll((v) => !v)}
                                className="min-h-[40px] px-4 rounded-xl glass-chip text-sm font-medium"
                            >
                                {showAll ? "Show fewer" : `Show all ${rows.length}`}
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}

function rowProps(s: UsageStudent, onOpen?: (id: string) => void) {
    if (!onOpen) return {};
    return {
        onClick: () => onOpen(s.student_id),
        tabIndex: 0,
        role: "button" as const,
        "aria-label": `View ${s.student_name}'s details`,
        onKeyDown: (e: React.KeyboardEvent) => {
            if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpen(s.student_id);
            }
        },
    };
}

function SortHeader({
    label,
    title,
    active,
    desc,
    onClick,
    className = "",
}: {
    label: string;
    title?: string;
    active: boolean;
    desc: boolean;
    onClick: () => void;
    className?: string;
}) {
    return (
        <th
            className={`px-3 py-2 font-medium whitespace-nowrap ${className}`}
            aria-sort={active ? (desc ? "descending" : "ascending") : "none"}
        >
            <button
                onClick={onClick}
                title={title}
                className={`inline-flex items-center gap-1 uppercase tracking-wider hover:text-foreground ${active ? "text-foreground" : ""}`}
            >
                {label}
                {active && (desc ? <ArrowDown className="w-3 h-3" /> : <ArrowUp className="w-3 h-3" />)}
            </button>
        </th>
    );
}
