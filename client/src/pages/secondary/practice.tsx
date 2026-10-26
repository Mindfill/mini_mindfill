import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useSearch } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import SecondaryShell, { AccessErrorState, PageLoader } from "@/components/secondary/SecondaryShell";
import DiagnosticPreparing, { PRACTICE_PHRASES } from "@/components/secondary/DiagnosticPreparing";
import { ProgressBar } from "@/components/secondary/ProgressBar";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { ArrowRight, Check, ChevronDown, Clock, History, Loader2, Lock, Minus, Plus } from "lucide-react";
import {
    CLASS_LEVELS,
    createPracticeQuiz,
    PRACTICE_DIFFICULTY_LABEL,
    SecondaryApiError,
    TUTOR_TYPES,
    type ChapterSummary,
    type ClassLevel,
    type PracticeDifficultyChoice,
    type PracticeHistoryItem,
    type PracticeLength,
    type PracticeSummary,
} from "@/lib/secondaryApi";
import {
    secondaryKeys,
    stampReceived,
    useChapterToc,
    useChapters,
    usePracticeHistory,
    useSubjects,
} from "@/lib/secondaryQueries";

const LENGTHS: PracticeLength[] = [10, 20, 30];
const DIFFICULTIES: PracticeDifficultyChoice[] = ["mixed", "foundational", "standard", "extended"];
// Timed mode: the student sets the time for the whole set, in these steps.
const TIME_STEP = 5;
const MIN_MINUTES = 5;
const MAX_MINUTES = 120;

/**
 * /secondary/practice[?chapter=<id>] — set up a practice quiz, and see how
 * past ones went.
 *
 * Four numbered steps, each opening only once the one before it is done, so
 * there's only ever one thing to decide: class → subject → chapters (and,
 * optionally, sections inside them) → quiz settings. Nothing is picked for the
 * student — the chapter list belongs to the subject they chose, and changing
 * the class clears everything after it. `?chapter=` arrives from the chapter
 * page's "Practice this chapter" and fills the first three steps.
 */
export default function PracticePage() {
    return <SecondaryShell>{({ accessToken }) => <PracticeSetup accessToken={accessToken} />}</SecondaryShell>;
}

function PracticeSetup({ accessToken }: { accessToken: string }) {
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const search = useSearch();
    const preselectChapter = new URLSearchParams(search).get("chapter");

    const [classLevel, setClassLevel] = useState<ClassLevel | null>(null);
    const [subjectId, setSubjectId] = useState<string | null>(null);
    const [chapterIds, setChapterIds] = useState<string[]>([]);
    const [sectionIds, setSectionIds] = useState<Record<string, string[]>>({});
    const [expanded, setExpanded] = useState<string | null>(null);
    const [length, setLength] = useState<PracticeLength>(10);
    const [difficulty, setDifficulty] = useState<PracticeDifficultyChoice>("mixed");
    const [timed, setTimed] = useState(false);
    // null = follow the length (a minute a question) until the student sets it.
    const [minutes, setMinutes] = useState<number | null>(null);
    const [starting, setStarting] = useState(false);
    const [startError, setStartError] = useState<unknown>(null);

    const subjects = useSubjects(accessToken, classLevel);
    const history = usePracticeHistory(accessToken);
    // Only used to place a pre-ticked chapter: its subject and class.
    const preselectToc = useChapterToc(preselectChapter ?? "", accessToken);

    useEffect(() => {
        document.title = "Practice | TECHCESS";
    }, []);

    // ?chapter= → its class, its subject, and it ticked. Once.
    const [preselected, setPreselected] = useState(false);
    useEffect(() => {
        if (preselected || !preselectChapter || !preselectToc.data) return;
        const { subject } = preselectToc.data;
        if (subject.class_level && CLASS_LEVELS.includes(subject.class_level as ClassLevel)) {
            setClassLevel(subject.class_level as ClassLevel);
        }
        setSubjectId(subject.subject_id);
        setChapterIds([preselectChapter]);
        setPreselected(true);
    }, [preselected, preselectChapter, preselectToc.data]);

    const subjectList = subjects.data?.subjects ?? null;
    // With no class picked yet the server answers for the student's own class.
    const activeClass = classLevel ?? subjects.data?.class_level ?? null;
    const subjectTitle = subjectList?.find((s) => s.subject_id === subjectId)?.title ?? preselectToc.data?.subject.title ?? null;

    // Each choice clears everything that depended on the one before it.
    const chooseClass = (level: ClassLevel) => {
        if (level === activeClass) return;
        setClassLevel(level);
        setSubjectId(null);
        setChapterIds([]);
        setSectionIds({});
        setExpanded(null);
        setStartError(null);
    };

    const chooseSubject = (id: string) => {
        if (id === subjectId) return;
        setSubjectId(id);
        setChapterIds([]);
        setSectionIds({});
        setExpanded(null);
        setStartError(null);
    };

    const toggleChapter = (id: string) => {
        setChapterIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
        setSectionIds((prev) => {
            const { [id]: _drop, ...rest } = prev;
            return rest;
        });
    };

    const toggleSection = (chapterId: string, sectionId: string) => {
        setSectionIds((prev) => {
            const current = prev[chapterId] ?? [];
            const next = current.includes(sectionId) ? current.filter((s) => s !== sectionId) : [...current, sectionId];
            return { ...prev, [chapterId]: next };
        });
        // Ticking a section implies its chapter.
        setChapterIds((prev) => (prev.includes(chapterId) ? prev : [...prev, chapterId]));
    };

    const timeMinutes = minutes ?? Math.max(MIN_MINUTES, length);

    const start = async () => {
        if (!subjectId || chapterIds.length === 0) return;
        setStarting(true);
        setStartError(null);
        try {
            const quiz = await createPracticeQuiz(
                {
                    subject_id: subjectId,
                    chapter_ids: chapterIds,
                    section_ids: chapterIds.flatMap((c) => sectionIds[c] ?? []),
                    question_count: length,
                    difficulty,
                    timed,
                    ...(timed ? { time_limit_minutes: timeMinutes } : {}),
                },
                accessToken,
            );
            queryClient.setQueryData(secondaryKeys.practiceQuiz(quiz.id), stampReceived(quiz));
            void queryClient.invalidateQueries({ queryKey: secondaryKeys.practiceHistory() });
            navigate(`/secondary/practice/${quiz.id}`);
        } catch (err) {
            setStartError(err);
            setStarting(false);
        }
    };

    if (subjects.error && !subjects.data) return <AccessErrorState error={subjects.error} onRetry={() => subjects.refetch()} />;
    if (!subjectList) return <PageLoader />;

    if (starting) {
        return (
            <main className="max-w-3xl mx-auto px-4 py-8 md:p-10 space-y-6">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Practice</h1>
                <DiagnosticPreparing phrases={PRACTICE_PHRASES} />
            </main>
        );
    }

    const unfinished = history.data?.quizzes.find((q) => q.status === "in_progress") ?? null;
    const sectionTicks = chapterIds.reduce((n, c) => n + (sectionIds[c]?.length ?? 0), 0);
    const chaptersDone = chapterIds.length > 0;

    return (
        <main className="max-w-3xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <header className="space-y-2">
                <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Practice</h1>
                <p className="text-muted-foreground">Build a quiz in four steps. Every quiz is new questions.</p>
            </header>

            {unfinished && (
                <button
                    onClick={() => navigate(`/secondary/practice/${unfinished.id}`)}
                    className="w-full glass-panel rounded-2xl p-4 flex items-center justify-between gap-3 text-left ring-2 ring-primary/40 min-h-[56px]"
                >
                    <span className="min-w-0">
                        <span className="block text-sm font-semibold">Finish your last quiz</span>
                        <span className="block text-xs text-muted-foreground truncate">
                            {unfinished.chapter_titles.join(", ")} · {unfinished.answered_count}/{unfinished.question_count} answered
                        </span>
                    </span>
                    <ArrowRight className="w-5 h-5 text-primary shrink-0" />
                </button>
            )}

            <section className="glass-panel rounded-3xl p-5 md:p-8 space-y-7" aria-label="Set up a quiz">
                <Step number={1} title="Choose your class" done={!!activeClass} active>
                    <div className="inline-flex glass-chip rounded-full p-1" role="tablist" aria-label="Class">
                        {CLASS_LEVELS.map((level) => (
                            <button
                                key={level}
                                type="button"
                                role="tab"
                                aria-selected={activeClass === level}
                                onClick={() => chooseClass(level)}
                                className={`min-h-[40px] min-w-[64px] px-4 rounded-full text-sm font-medium transition-colors ${
                                    activeClass === level ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {level}
                            </button>
                        ))}
                    </div>
                </Step>

                <Step
                    number={2}
                    title={activeClass ? `Choose a ${activeClass} subject` : "Choose a subject"}
                    done={!!subjectId}
                    active={!!activeClass}
                >
                    {subjectList.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {activeClass ?? "These"} lessons are on the way — try another class.
                        </p>
                    ) : (
                        <div className={`flex flex-wrap gap-2 ${subjects.isPlaceholderData ? "opacity-60" : ""}`}>
                            {subjectList.map((s) => (
                                <button
                                    key={s.subject_id}
                                    onClick={() => chooseSubject(s.subject_id)}
                                    aria-pressed={subjectId === s.subject_id}
                                    className={`min-h-[44px] px-4 rounded-full text-sm font-medium border transition-colors ${
                                        subjectId === s.subject_id
                                            ? "border-primary bg-primary/10 text-foreground"
                                            : "border-border text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    {s.title}
                                </button>
                            ))}
                        </div>
                    )}
                </Step>

                <Step
                    number={3}
                    title={subjectTitle ? `Choose chapters in ${subjectTitle}` : "Choose chapters"}
                    hint={subjectId ? "Tick one or more. Open a chapter to narrow it to specific sections — optional." : "Pick a subject first."}
                    done={chaptersDone}
                    active={!!subjectId}
                >
                    {subjectId && (
                        <ChapterPicker
                            subjectId={subjectId}
                            accessToken={accessToken}
                            chapterIds={chapterIds}
                            sectionIds={sectionIds}
                            expanded={expanded}
                            onExpand={(id) => setExpanded((prev) => (prev === id ? null : id))}
                            onToggleChapter={toggleChapter}
                            onToggleSection={toggleSection}
                        />
                    )}
                </Step>

                <Step
                    number={4}
                    title="Set up the quiz"
                    hint={chaptersDone ? undefined : "Tick at least one chapter first."}
                    done={false}
                    active={chaptersDone}
                    last
                >
                    {chaptersDone && (
                        <div className="space-y-6">
                            <div className="grid sm:grid-cols-2 gap-6">
                                <ChoiceRow label="Questions">
                                    {LENGTHS.map((n) => (
                                        <Chip key={n} selected={length === n} onClick={() => setLength(n)} wide>
                                            {n}
                                        </Chip>
                                    ))}
                                </ChoiceRow>
                                <ChoiceRow label="Difficulty">
                                    {DIFFICULTIES.map((d) => (
                                        <Chip key={d} selected={difficulty === d} onClick={() => setDifficulty(d)}>
                                            {PRACTICE_DIFFICULTY_LABEL[d]}
                                        </Chip>
                                    ))}
                                </ChoiceRow>
                            </div>

                            <div className="space-y-3">
                                <label className="flex items-center justify-between gap-4 min-h-[44px] cursor-pointer">
                                    <span className="min-w-0">
                                        <span className="flex items-center gap-2 text-sm font-medium">
                                            <Clock className="w-4 h-4" aria-hidden /> Timed
                                        </span>
                                        <span className="block text-xs text-muted-foreground mt-0.5">
                                            {timed
                                                ? "Exam style — answers are shown at the end."
                                                : "Off — see each answer and its working as you go."}
                                        </span>
                                    </span>
                                    <Switch checked={timed} onCheckedChange={setTimed} aria-label="Timed mode" />
                                </label>
                                {timed && (
                                    <TimeStepper
                                        minutes={timeMinutes}
                                        questions={length}
                                        onChange={(m) => setMinutes(m)}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </Step>

                {startError != null && <StartError error={startError} onUpgrade={() => navigate("/upgrade")} />}

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-4 border-t border-border">
                    <button
                        onClick={start}
                        disabled={!subjectId || !chaptersDone}
                        className="w-full sm:w-auto min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        Start quiz <ArrowRight className="w-4 h-4" />
                    </button>
                    <p className="text-xs text-muted-foreground min-w-0">
                        {!chaptersDone
                            ? "Finish the steps above to start."
                            : [
                                  subjectTitle,
                                  `${chapterIds.length} chapter${chapterIds.length === 1 ? "" : "s"}`,
                                  sectionTicks ? `${sectionTicks} section${sectionTicks === 1 ? "" : "s"}` : null,
                                  `${length} questions`,
                                  PRACTICE_DIFFICULTY_LABEL[difficulty],
                                  timed ? `${timeMinutes} min` : "untimed",
                              ]
                                  .filter(Boolean)
                                  .join(" · ")}
                    </p>
                </div>
            </section>

            <PracticeHistory
                loading={history.isLoading}
                quizzes={history.data?.quizzes ?? []}
                summary={history.data?.summary ?? null}
                onOpen={(id) => navigate(`/secondary/practice/${id}`)}
            />
        </main>
    );
}

/** One numbered step. Upcoming steps stay visible but dimmed, with a line
 *  saying what unlocks them, so the student can see the whole path. */
function Step({
    number,
    title,
    hint,
    done,
    active,
    last = false,
    children,
}: {
    number: number;
    title: string;
    hint?: string;
    done: boolean;
    active: boolean;
    last?: boolean;
    children?: ReactNode;
}) {
    return (
        <div className={`relative flex gap-4 ${active ? "" : "opacity-50"}`} aria-disabled={!active}>
            <div className="flex flex-col items-center shrink-0">
                <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold border ${
                        done
                            ? "bg-primary text-primary-foreground border-primary"
                            : active
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                    }`}
                    aria-hidden
                >
                    {done ? <Check className="w-4 h-4" /> : number}
                </span>
                {!last && <span className="flex-1 w-px bg-border mt-2" aria-hidden />}
            </div>
            <div className="flex-1 min-w-0 space-y-3 pb-1">
                <div>
                    <h2 className="text-base font-semibold leading-8">
                        <span className="sr-only">Step {number}: </span>
                        {title}
                    </h2>
                    {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
                </div>
                {active && children}
            </div>
        </div>
    );
}

function ChoiceRow({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
                {children}
            </div>
        </div>
    );
}

function Chip({ selected, onClick, wide = false, children }: { selected: boolean; onClick: () => void; wide?: boolean; children: ReactNode }) {
    return (
        <button
            role="radio"
            aria-checked={selected}
            onClick={onClick}
            className={`min-h-[44px] ${wide ? "min-w-[56px] font-semibold" : "font-medium"} px-4 rounded-full text-sm border transition-colors ${
                selected ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            }`}
        >
            {children}
        </button>
    );
}

function perQuestion(minutes: number, questions: number): string {
    const seconds = Math.round((minutes * 60) / questions);
    if (seconds < 60) return `${seconds} s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s ? `${m} min ${s} s` : `${m} min`;
}

/** How long the student gives themselves for the whole set. */
function TimeStepper({ minutes, questions, onChange }: { minutes: number; questions: number; onChange: (m: number) => void }) {
    const step = (dir: 1 | -1) => {
        // Snap to the 5-minute grid first, so 12 → 15 / 10 rather than 17 / 7.
        const snapped = dir === 1 ? Math.floor(minutes / TIME_STEP) * TIME_STEP + TIME_STEP : Math.ceil(minutes / TIME_STEP) * TIME_STEP - TIME_STEP;
        onChange(Math.min(MAX_MINUTES, Math.max(MIN_MINUTES, snapped)));
    };
    return (
        <div className="rounded-2xl border border-border p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
                <p className="text-sm font-medium">Time for the whole quiz</p>
                <p className="text-xs text-muted-foreground mt-0.5">About {perQuestion(minutes, questions)} per question</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <button
                    type="button"
                    onClick={() => step(-1)}
                    disabled={minutes <= MIN_MINUTES}
                    aria-label="Less time"
                    className="w-11 h-11 rounded-full glass-chip flex items-center justify-center disabled:opacity-40"
                >
                    <Minus className="w-4 h-4" />
                </button>
                <span className="w-16 text-center font-semibold tabular-nums" aria-live="polite">
                    {minutes} min
                </span>
                <button
                    type="button"
                    onClick={() => step(1)}
                    disabled={minutes >= MAX_MINUTES}
                    aria-label="More time"
                    className="w-11 h-11 rounded-full glass-chip flex items-center justify-center disabled:opacity-40"
                >
                    <Plus className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

function ChapterPicker({
    subjectId,
    accessToken,
    chapterIds,
    sectionIds,
    expanded,
    onExpand,
    onToggleChapter,
    onToggleSection,
}: {
    subjectId: string;
    accessToken: string;
    chapterIds: string[];
    sectionIds: Record<string, string[]>;
    expanded: string | null;
    onExpand: (id: string) => void;
    onToggleChapter: (id: string) => void;
    onToggleSection: (chapterId: string, sectionId: string) => void;
}) {
    const [, navigate] = useLocation();
    const { data, error, refetch } = useChapters(subjectId, accessToken);

    if (error && !data) {
        return (
            <div className="text-sm text-red-700 dark:text-red-400" role="alert">
                Couldn't load the chapters.{" "}
                <button onClick={() => refetch()} className="underline min-h-[44px]">
                    Try again
                </button>
            </div>
        );
    }
    // A different subject's chapters must never show while this one loads.
    if (!data || data.subject.subject_id !== subjectId) {
        return (
            <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
        );
    }

    const chapters = data.chapters;
    if (chapters.length === 0) return <p className="text-sm text-muted-foreground">Chapters are on the way.</p>;
    return (
        <ul className="space-y-2">
            {chapters.map((c) => (
                <ChapterRow
                    key={c.chapter_id}
                    chapter={c}
                    accessToken={accessToken}
                    checked={chapterIds.includes(c.chapter_id)}
                    pickedSections={sectionIds[c.chapter_id] ?? []}
                    open={expanded === c.chapter_id}
                    onExpand={() => onExpand(c.chapter_id)}
                    onToggle={() => onToggleChapter(c.chapter_id)}
                    onToggleSection={(sid) => onToggleSection(c.chapter_id, sid)}
                    onUpgrade={() => navigate("/upgrade")}
                />
            ))}
        </ul>
    );
}

function ChapterRow({
    chapter: c,
    accessToken,
    checked,
    pickedSections,
    open,
    onExpand,
    onToggle,
    onToggleSection,
    onUpgrade,
}: {
    chapter: ChapterSummary;
    accessToken: string;
    checked: boolean;
    pickedSections: string[];
    open: boolean;
    onExpand: () => void;
    onToggle: () => void;
    onToggleSection: (sectionId: string) => void;
    onUpgrade: () => void;
}) {
    const unavailable = c.coming_soon || c.requires_subscription;
    const id = `practice-chapter-${c.chapter_id}`;

    return (
        <li className={`rounded-2xl border border-border ${checked ? "bg-primary/5 border-primary/40" : ""}`}>
            <div className="flex items-center gap-3 px-3 min-h-[56px]">
                <Checkbox id={id} checked={checked} onCheckedChange={onToggle} disabled={unavailable} className="h-5 w-5" />
                <label htmlFor={id} className={`flex-1 min-w-0 py-2 ${unavailable ? "opacity-60" : "cursor-pointer"}`}>
                    <span className="block text-xs font-mono text-muted-foreground">
                        Chapter {String(c.chapter_number).padStart(2, "0")}
                        {c.is_free ? " · Free" : ""}
                    </span>
                    <span className="block text-sm font-medium leading-snug">{c.chapter_title}</span>
                    {checked && (
                        <span className="block text-xs text-primary mt-0.5">
                            {pickedSections.length > 0
                                ? `${pickedSections.length} section${pickedSections.length === 1 ? "" : "s"}`
                                : "Whole chapter"}
                        </span>
                    )}
                </label>
                {c.coming_soon ? (
                    <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
                        <Clock className="w-3.5 h-3.5" /> Soon
                    </span>
                ) : c.requires_subscription ? (
                    <button
                        onClick={onUpgrade}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground flex items-center gap-1 shrink-0 min-h-[44px] px-2"
                    >
                        <Lock className="w-3.5 h-3.5" /> Subscribe
                    </button>
                ) : (
                    <button
                        onClick={onExpand}
                        aria-expanded={open}
                        aria-label={`Pick sections in ${c.chapter_title}`}
                        className="shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                    >
                        <span className="hidden sm:inline">Sections</span>
                        <ChevronDown className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`} />
                    </button>
                )}
            </div>
            {open && !unavailable && (
                <SectionList chapterId={c.chapter_id} accessToken={accessToken} picked={pickedSections} onToggle={onToggleSection} />
            )}
        </li>
    );
}

function SectionList({
    chapterId,
    accessToken,
    picked,
    onToggle,
}: {
    chapterId: string;
    accessToken: string;
    picked: string[];
    onToggle: (sectionId: string) => void;
}) {
    const { data, error } = useChapterToc(chapterId, accessToken);
    // Sections made only of quizzes / chapter problems have no lesson text to
    // write questions from — the server would skip them anyway.
    const sections = useMemo(
        () => (data?.sections ?? []).filter((s) => s.subsections.some((sub) => TUTOR_TYPES.includes(sub.subsection_type))),
        [data],
    );

    if (error && !data) return <p className="px-4 pb-3 text-sm text-red-700 dark:text-red-400">Couldn't load the sections.</p>;
    if (!data) {
        return (
            <div className="flex justify-center pb-3">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
            </div>
        );
    }

    return (
        <div className="px-3 pb-3 space-y-1 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground px-1 pb-1">
                {picked.length === 0 ? "None ticked — the whole chapter is included." : "Only the ticked sections are included."}
            </p>
            {sections.map((s) => {
                const id = `practice-section-${s.section_id}`;
                return (
                    <div key={s.section_id} className="flex items-center gap-3 min-h-[44px] pl-6">
                        <Checkbox id={id} checked={picked.includes(s.section_id)} onCheckedChange={() => onToggle(s.section_id)} className="h-5 w-5" />
                        <label htmlFor={id} className="flex-1 min-w-0 text-sm cursor-pointer py-2">
                            {s.section_label}
                        </label>
                    </div>
                );
            })}
        </div>
    );
}

function StartError({ error, onUpgrade }: { error: unknown; onUpgrade: () => void }) {
    const e = error instanceof SecondaryApiError ? error : null;
    let message = error instanceof Error ? error.message : "Couldn't prepare your quiz";
    let upgrade = false;
    if (e?.status === 402 || e?.reason === "subscription_required") {
        message = "One of those chapters is part of the full course. Subscribe to practice it, or untick it.";
        upgrade = true;
    } else if (e?.reason === "generation_failed") {
        message = "Couldn't write the questions just now. That's on us — try again in a moment.";
    } else if (e?.reason === "nothing_to_practice") {
        message = "Those sections don't have lessons to make questions from yet. Pick another section or the whole chapter.";
    } else if (e?.reason === "coming_soon") {
        message = "One of those chapters isn't ready yet.";
    } else if (e?.status === 403) {
        message = "This device isn't registered for your plan. Manage your devices from your profile.";
    }
    return (
        <div className="text-sm text-red-700 dark:text-red-400 space-y-2" role="alert">
            <p>{message}</p>
            {upgrade && (
                <button onClick={onUpgrade} className="min-h-[44px] px-5 rounded-full bg-primary text-primary-foreground text-sm font-medium">
                    See plans
                </button>
            )}
        </div>
    );
}

function relativeDay(iso: string | null): string {
    if (!iso) return "";
    const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
    if (days <= 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function PracticeHistory({
    loading,
    quizzes,
    summary,
    onOpen,
}: {
    loading: boolean;
    quizzes: PracticeHistoryItem[];
    summary: PracticeSummary | null;
    onOpen: (id: string) => void;
}) {
    if (loading) return null;
    if (quizzes.length === 0) {
        return (
            <section className="glass-panel rounded-2xl p-6 text-sm text-muted-foreground flex items-center gap-3">
                <History className="w-5 h-5 shrink-0" aria-hidden />
                Your quizzes and scores will show up here.
            </section>
        );
    }

    return (
        <div className="space-y-8">
            {summary && summary.by_chapter.length > 0 && (
                <section className="space-y-3">
                    <div className="flex items-baseline justify-between gap-3">
                        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                            Accuracy · last {summary.window_days} days
                        </h2>
                        {summary.accuracy_percent !== null && (
                            <span className="text-sm font-semibold">{summary.accuracy_percent}% overall</span>
                        )}
                    </div>
                    <div className="glass-panel rounded-2xl p-5 space-y-4">
                        {summary.by_chapter.map((c) => (
                            <ProgressBar
                                key={c.chapter_id}
                                value={c.accuracy_percent}
                                complete={c.accuracy_percent === 100}
                                label={`${c.chapter_title} · ${c.correct}/${c.answered} right`}
                            />
                        ))}
                    </div>
                </section>
            )}

            <section className="space-y-3">
                <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Recent quizzes</h2>
                <ul className="space-y-2">
                    {quizzes.map((q) => {
                        const pct = q.question_count ? Math.round((q.correct_count / q.question_count) * 100) : 0;
                        const tone =
                            pct >= 70
                                ? "text-emerald-700 dark:text-emerald-400"
                                : pct >= 50
                                  ? "text-amber-700 dark:text-amber-400"
                                  : "text-red-700 dark:text-red-400";
                        return (
                            <li key={q.id}>
                                <button
                                    onClick={() => onOpen(q.id)}
                                    className="w-full glass-panel rounded-2xl px-4 py-3 min-h-[56px] flex items-center justify-between gap-3 text-left"
                                >
                                    <span className="min-w-0">
                                        <span className="block text-sm font-medium truncate">{q.chapter_titles.join(", ") || "Practice quiz"}</span>
                                        <span className="block text-xs text-muted-foreground">
                                            {relativeDay(q.finished_at ?? q.started_at)} · {PRACTICE_DIFFICULTY_LABEL[q.difficulty]}
                                            {q.timed ? " · Timed" : ""}
                                        </span>
                                    </span>
                                    {q.status === "finished" ? (
                                        <span className={`text-sm font-semibold shrink-0 ${tone}`}>
                                            {q.correct_count}/{q.question_count}
                                        </span>
                                    ) : (
                                        <span className="text-xs font-medium text-primary shrink-0">
                                            Continue · {q.answered_count}/{q.question_count}
                                        </span>
                                    )}
                                </button>
                            </li>
                        );
                    })}
                </ul>
            </section>
        </div>
    );
}
