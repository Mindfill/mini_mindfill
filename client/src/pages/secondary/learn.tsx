import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { motion } from "motion/react";
import SecondaryShell, { AccessErrorState, PageSkeleton } from "@/components/secondary/SecondaryShell";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import { Lock, CheckCircle2, Sparkles, ChevronRight, Clock } from "lucide-react";
import { type ChapterSummary, type SubjectSummary } from "@/lib/secondaryApi";
import { useChapters, useSubjects } from "@/lib/secondaryQueries";

/**
 * /secondary/learn            → subject list (skipped straight to chapters when there's one subject)
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

function SubjectList({ accessToken }: { accessToken: string }) {
    const [, navigate] = useLocation();
    const { data, error, refetch } = useSubjects(accessToken);
    const subjects: SubjectSummary[] | null = data?.subjects ?? null;
    const onlySubject = subjects?.length === 1 ? subjects[0].subject_id : null;

    useEffect(() => {
        document.title = "Learn | TECHCESS";
    }, []);

    useEffect(() => {
        if (onlySubject) navigate(`/secondary/learn/${onlySubject}`, { replace: true });
    }, [onlySubject, navigate]);

    if (error && !data) return <AccessErrorState error={error} onRetry={() => refetch()} />;
    if (!subjects || onlySubject) return <PageSkeleton />;

    return (
        <main className="max-w-4xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <header>
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Your subjects</h1>
                <p className="text-muted-foreground mt-2">Pick up where you left off, or start something new.</p>
            </header>
            {subjects.length === 0 ? (
                <div className="glass-panel rounded-2xl p-8 text-center text-muted-foreground">
                    Your lessons aren't ready yet — check back soon.
                </div>
            ) : (
                <div className="grid sm:grid-cols-2 gap-4">
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
    else if (c.locked) stateLabel = <span className="flex items-center gap-1.5"><Lock className="w-3.5 h-3.5" /> Finish the previous chapter</span>;
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
