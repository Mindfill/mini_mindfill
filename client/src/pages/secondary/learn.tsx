import { useEffect } from "react";
import { useLocation, useParams, useSearch } from "wouter";
import { motion } from "motion/react";
import SecondaryShell, { AccessErrorState, PageSkeleton } from "@/components/secondary/SecondaryShell";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import { Lock, CheckCircle2, Sparkles, ChevronRight, Clock } from "lucide-react";
import { CLASS_LEVELS, type ChapterSummary, type ClassLevel, type SubjectSummary } from "@/lib/secondaryApi";
import { useChapters, useSubjects } from "@/lib/secondaryQueries";

/**
 * /secondary/learn[?class=SS2] → SS1/SS2/SS3 tabs → that class's subjects
 * /secondary/learn/:subjectId → chapter grid
 */
export default function Learn() {
    const params = useParams<{ subjectId?: string }>();
    return (
        <SecondaryShell>
            {({ accessToken }) =>
                params.subjectId ? (
                    <ChapterGrid subjectId={params.subjectId} accessToken={accessToken} />
                ) : (
                    <SubjectList accessToken={accessToken} />
                )
            }
        </SecondaryShell>
    );
}

/**
 * Every student can browse every class (David, 2026-09-19): SS1 / SS2 / SS3
 * tabs, each listing that class's subjects. The tab lives in the URL
 * (?class=SS2) so Back from a subject returns to the same class. With no
 * ?class the server answers for the student's own class.
 *
 * The old version skipped straight to the chapter grid when there was only
 * one subject — with tabs that would have hidden the other classes, so it's gone.
 */
function SubjectList({ accessToken }: { accessToken: string }) {
    const [, navigate] = useLocation();
    const search = useSearch();
    const requested = new URLSearchParams(search).get("class");
    const selected = CLASS_LEVELS.includes(requested as ClassLevel) ? (requested as ClassLevel) : null;

    const { data, error, refetch, isPlaceholderData } = useSubjects(accessToken, selected);
    const subjects: SubjectSummary[] | null = data?.subjects ?? null;
    const activeClass = selected ?? data?.class_level ?? null;
    const ownClass = data?.student_class_level ?? null;

    useEffect(() => {
        document.title = "Learn | TECHCESS";
    }, []);

    if (error && !data) return <AccessErrorState error={error} onRetry={() => refetch()} />;
    if (!subjects) return <PageSkeleton />;

    return (
        <main className="max-w-4xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <header className="space-y-5">
                <div>
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Subjects</h1>
                    <p className="text-muted-foreground mt-2">Pick a class, then a subject.</p>
                </div>
                <div className="inline-flex glass-chip rounded-full p-1" role="tablist" aria-label="Class">
                    {CLASS_LEVELS.map((level) => (
                        <button
                            key={level}
                            type="button"
                            role="tab"
                            aria-selected={activeClass === level}
                            onClick={() => navigate(`/secondary/learn?class=${level}`, { replace: true })}
                            className={`min-h-[40px] min-w-[64px] px-4 rounded-full text-sm font-medium transition-colors ${
                                activeClass === level ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {level}
                            {level === ownClass && <span className="sr-only"> (your class)</span>}
                        </button>
                    ))}
                </div>
            </header>
            {subjects.length === 0 ? (
                <div className={`glass-panel rounded-2xl p-8 text-center space-y-4 ${isPlaceholderData ? "opacity-60" : ""}`}>
                    <p className="text-muted-foreground">{activeClass ?? "These"} lessons are on the way — check back soon.</p>
                    {/* Mental Models is free for every class — never leave someone with nothing to do. */}
                    <button
                        onClick={() => navigate("/secondary/start")}
                        className="min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium"
                    >
                        Start with Mental Models (free) →
                    </button>
                </div>
            ) : (
                <div className={`grid sm:grid-cols-2 gap-4 ${isPlaceholderData ? "opacity-60" : ""}`} aria-busy={isPlaceholderData}>
                    {subjects.map((s, i) => (
                        <motion.button
                            key={s.subject_id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05, duration: 0.3 }}
                            whileHover={{ y: -2 }}
                            onClick={() => navigate(`/secondary/learn/${s.subject_id}`)}
                            className="glass-panel rounded-2xl p-6 text-left space-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                        >
                            <div className="flex items-start justify-between gap-3">
                                <h2 className="text-xl font-semibold">{s.title}</h2>
                                {s.is_complete ? <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-label="Complete" /> : <ChevronRight className="w-5 h-5 text-muted-foreground shrink-0" />}
                            </div>
                            {s.description && <p className="text-sm text-muted-foreground line-clamp-2">{s.description}</p>}
                            <ProgressBar value={s.percent_complete} complete={s.is_complete} label={`${s.completed_subsections} of ${s.total_subsections} lessons`} />
                        </motion.button>
                    ))}
                </div>
            )}
        </main>
    );
}

function ChapterGrid({ subjectId, accessToken }: { subjectId: string; accessToken: string }) {
    const [, navigate] = useLocation();
    const { data, error, refetch } = useChapters(subjectId, accessToken);

    useEffect(() => {
        if (data) document.title = `${data.subject.title} | TECHCESS`;
    }, [data]);

    if (error && !data) return <AccessErrorState error={error} onRetry={() => refetch()} />;
    if (!data) return <PageSkeleton />;

    return (
        <main className="max-w-5xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <header>
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Subject</p>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{data.subject.title}</h1>
            </header>

            {data.chapters.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground">Chapters are on the way.</div>
            ) : (
                <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {data.chapters.map((c, i) => (
                        <ChapterCard
                            key={c.chapter_id}
                            chapter={c}
                            index={i}
                            onOpen={() => {
                                if (c.requires_subscription) navigate("/upgrade");
                                else navigate(`/secondary/chapters/${c.chapter_id}`);
                            }}
                        />
                    ))}
                </div>
            )}
        </main>
    );
}

function ChapterCard({ chapter: c, index, onOpen }: { chapter: ChapterSummary; index: number; onOpen: () => void }) {
    const startHere = c.is_free && !c.is_complete && c.completed_subsections === 0;
    const disabled = c.coming_soon || (c.locked && !c.requires_subscription);

    let stateLabel: React.ReactNode;
    if (c.coming_soon) stateLabel = <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" /> Coming soon</span>;
    else if (c.is_complete) stateLabel = <span className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Complete</span>;
    else if (c.requires_subscription) stateLabel = <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Subscribe to unlock</span>;
    // No "finish the previous chapter" state any more — chapters are freely
    // enterable (David, 2026-09-21). `locked` now only ever means coming_soon,
    // which is handled above. Sequencing lives on the lessons inside a chapter.
    else if (c.completed_subsections > 0) stateLabel = <span className="text-primary">In progress</span>;
    else stateLabel = <span className="text-primary">Ready to start</span>;

    return (
        <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: Math.min(index, 8) * 0.04, duration: 0.3 }}
            whileHover={disabled ? undefined : { y: -2 }}
            onClick={onOpen}
            disabled={disabled}
            aria-label={`Chapter ${c.chapter_number}: ${c.chapter_title}`}
            className={`relative rounded-2xl p-5 text-left flex flex-col gap-4 min-h-[180px] transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
                startHere ? "glass-panel ring-2 ring-primary/60" : "glass-panel"
            } ${disabled ? "opacity-55 cursor-not-allowed" : ""}`}
        >
            {startHere && (
                <span className="absolute -top-2.5 left-5 text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full bg-primary text-primary-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Start here
                </span>
            )}
            <div>
                <p className="text-xs font-mono text-muted-foreground">
                    Chapter {String(c.chapter_number).padStart(2, "0")}{c.is_free ? " · Free" : ""}
                </p>
                <h2 className="text-lg font-semibold leading-snug mt-1">{c.chapter_title}</h2>
            </div>
            <div className="mt-auto space-y-3">
                {!c.coming_soon && (
                    <ProgressBar value={c.percent_complete} complete={c.is_complete} label={`${c.completed_subsections}/${c.total_subsections}`} />
                )}
                <p className="text-xs font-medium text-muted-foreground">{stateLabel}</p>
            </div>
        </motion.button>
    );
}
