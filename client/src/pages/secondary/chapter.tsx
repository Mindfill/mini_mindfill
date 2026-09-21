import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import SecondaryShell, { AccessErrorState, PageSkeleton } from "@/components/secondary/SecondaryShell";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import CircuitBoard from "@/components/secondary/CircuitBoard";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { CheckCircle2, Circle, Lock, PlayCircle, ChevronLeft, CircuitBoard as BoardIcon, List } from "lucide-react";
import { SUBSECTION_TYPE_LABEL, type TocSubsection } from "@/lib/secondaryApi";
import { useChapterToc } from "@/lib/secondaryQueries";

/** Which chapter navigation to show. Remembered per browser so a student who
 *  picks one isn't switched back on every visit; defaults to the new board. */
const VIEW_KEY = "techcess.chapterView";

function useChapterView() {
    const [view, setView] = useState<"board" | "list">(() => {
        try {
            return localStorage.getItem(VIEW_KEY) === "list" ? "list" : "board";
        } catch {
            return "board";
        }
    });
    const choose = (next: "board" | "list") => {
        setView(next);
        try {
            localStorage.setItem(VIEW_KEY, next);
        } catch {
            /* private mode — the choice just won't persist */
        }
    };
    return [view, choose] as const;
}

export default function ChapterPage() {
    const { chapterId } = useParams<{ chapterId: string }>();
    return (
        <SecondaryShell>
            {({ accessToken }) => <ChapterToc chapterId={chapterId} accessToken={accessToken} />}
        </SecondaryShell>
    );
}

function ChapterToc({ chapterId, accessToken }: { chapterId: string; accessToken: string }) {
    const [, navigate] = useLocation();
    const { data, error, refetch } = useChapterToc(chapterId, accessToken);
    const [view, setView] = useChapterView();

    useEffect(() => {
        if (data) document.title = `${data.chapter.chapter_title} | TECHCESS`;
    }, [data]);

    // Open the section holding the student's next lesson; fall back to the first.
    const { defaultOpen, resume } = useMemo(() => {
        if (!data) return { defaultOpen: undefined, resume: null as TocSubsection | null };
        for (const sec of data.sections) {
            const pick = sec.subsections.find((s) => s.available && s.status !== "completed");
            if (pick) return { defaultOpen: sec.section_id, resume: pick };
        }
        return { defaultOpen: data.sections[0]?.section_id, resume: null };
    }, [data]);

    // A locked lesson isn't a dead end: it leads to the prerequisite
    // diagnostic, which can open it. Both navigations live here so the board
    // and the list can't drift.
    const openSubsection = (s: TocSubsection) =>
        navigate(
            s.available
                ? `/secondary/subsections/${s.subsection_id}`
                : `/secondary/diagnostic/${s.subsection_id}`,
        );

    if (error && !data) return <AccessErrorState error={error} onRetry={() => refetch()} />;
    if (!data) return <PageSkeleton />;

    const { chapter, sections, subject } = data;

    return (
        <main className="max-w-3xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <button
                onClick={() => navigate(`/secondary/learn/${subject.subject_id}`)}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground min-h-[44px] -ml-1"
            >
                <ChevronLeft className="w-4 h-4" /> {subject.title}
            </button>

            <header className="space-y-4">
                <div>
                    <p className="text-xs font-mono text-muted-foreground">
                        Chapter {String(chapter.chapter_number).padStart(2, "0")}{chapter.is_free ? " · Free" : ""}
                    </p>
                    <h1 className="text-3xl md:text-4xl font-semibold tracking-tight mt-1">{chapter.chapter_title}</h1>
                </div>
                {chapter.learning_objectives.length > 0 && (
                    <ul className="space-y-1.5">
                        {chapter.learning_objectives.map((o) => (
                            <li key={o} className="text-sm text-muted-foreground flex gap-2">
                                <span className="text-primary mt-0.5">•</span> {o}
                            </li>
                        ))}
                    </ul>
                )}
                <ProgressBar
                    value={chapter.percent_complete}
                    complete={chapter.is_complete}
                    label={`${chapter.completed_subsections} of ${chapter.total_subsections} lessons complete`}
                />
                {resume && (
                    <button
                        onClick={() => navigate(`/secondary/subsections/${resume.subsection_id}`)}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium flex items-center justify-center gap-2"
                    >
                        <PlayCircle className="w-5 h-5" />
                        {chapter.completed_subsections > 0 ? "Continue" : "Start"}: {resume.subsection_title}
                    </button>
                )}
            </header>

            <div className="flex items-center justify-end">
                <div className="inline-flex glass-chip rounded-full p-1" role="group" aria-label="Chapter view">
                    {([
                        { id: "board" as const, label: "Board", Icon: BoardIcon },
                        { id: "list" as const, label: "List", Icon: List },
                    ]).map(({ id, label, Icon }) => (
                        <button
                            key={id}
                            type="button"
                            onClick={() => setView(id)}
                            aria-pressed={view === id}
                            className={`min-h-[36px] px-3 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors ${
                                view === id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {view === "board" ? (
                <CircuitBoard
                    sections={sections}
                    currentId={resume?.subsection_id}
                    onOpen={(id) => {
                        const sub = sections.flatMap((s) => s.subsections).find((s) => s.subsection_id === id);
                        if (sub) openSubsection(sub);
                    }}
                />
            ) : (
            <Accordion type="multiple" defaultValue={defaultOpen ? [defaultOpen] : []} className="space-y-3">
                {sections.map((sec) => (
                    <AccordionItem key={sec.section_id} value={sec.section_id} className="glass-panel rounded-2xl border-0 px-4 md:px-5">
                        <AccordionTrigger className="hover:no-underline py-4 min-h-[56px]">
                            <div className="flex items-center gap-3 text-left">
                                {sec.is_complete ? (
                                    <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400 shrink-0" aria-label="Section complete" />
                                ) : (
                                    <span className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 text-[10px] font-semibold flex items-center justify-center shrink-0">
                                        {sec.section_number}
                                    </span>
                                )}
                                <div>
                                    <p className="font-semibold leading-snug">{sec.section_label}</p>
                                    <p className="text-xs text-muted-foreground font-normal">
                                        {sec.completed_subsections}/{sec.subsections.length} complete
                                    </p>
                                </div>
                            </div>
                        </AccordionTrigger>
                        <AccordionContent>
                            <ol className="pb-2 space-y-1">
                                {sec.subsections.map((s) => (
                                    <li key={s.subsection_id}>
                                        <SubsectionRow sub={s} onOpen={() => openSubsection(s)} />
                                    </li>
                                ))}
                            </ol>
                        </AccordionContent>
                    </AccordionItem>
                ))}
            </Accordion>
            )}
        </main>
    );
}

function SubsectionRow({ sub, onOpen }: { sub: TocSubsection; onOpen: () => void }) {
    const icon =
        sub.status === "completed" ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-700 dark:text-emerald-400" aria-label="Complete" />
        ) : !sub.available ? (
            <Lock className="w-4 h-4 text-muted-foreground" aria-label="Locked" />
        ) : sub.status === "in_progress" ? (
            <PlayCircle className="w-5 h-5 text-primary" aria-label="In progress" />
        ) : (
            <Circle className="w-5 h-5 text-muted-foreground/60" aria-label="Not started" />
        );

    // Locked rows stay tappable — they lead to the skip check, not nowhere.
    return (
        <button
            onClick={onOpen}
            aria-label={sub.available ? undefined : `${sub.subsection_title} — locked, take the skip check`}
            className="w-full min-h-[52px] flex items-center gap-3 px-3 rounded-xl text-left hover:bg-muted/60 transition-colors"
        >
            <span className="w-5 flex justify-center shrink-0">{icon}</span>
            <span className={`flex-1 text-sm ${sub.available ? "" : "text-muted-foreground"}`}>{sub.subsection_title}</span>
            {!sub.available && (
                <span className="text-[11px] font-medium px-2 py-0.5 rounded-full border border-primary/40 text-primary shrink-0">
                    Skip check
                </span>
            )}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full glass-chip text-muted-foreground shrink-0">
                {SUBSECTION_TYPE_LABEL[sub.subsection_type] ?? sub.subsection_type}
            </span>
        </button>
    );
}
