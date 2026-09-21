import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import { secondaryKeys, useSubsection } from "@/lib/secondaryQueries";
import SecondaryShell, { AccessErrorState, PageSkeleton } from "@/components/secondary/SecondaryShell";
import StaticContent from "@/components/secondary/StaticContent";
import TutorChat, { type TutorProgress } from "@/components/secondary/TutorChat";
import MiniQuiz from "@/components/secondary/MiniQuiz";
import EndOfChapter from "@/components/secondary/EndOfChapter";
import NextButton from "@/components/secondary/NextButton";
import ChapterCelebration from "@/components/secondary/ChapterCelebration";
import { ChevronRight, CheckCircle2 } from "lucide-react";
import {
    completeSession,
    SecondaryApiError,
    SUBSECTION_TYPE_LABEL,
    TUTOR_TYPES,
    type NextDestination,
    type Progression,
} from "@/lib/secondaryApi";

export default function SubsectionPage() {
    const { subsectionId } = useParams<{ subsectionId: string }>();

    return (
        <SecondaryShell trackActivity>
            {({ accessToken }) => (
                // key: a new subsection is a fresh page — no state carries over.
                <SubsectionView key={subsectionId} subsectionId={subsectionId} accessToken={accessToken} />
            )}
        </SecondaryShell>
    );
}

function SubsectionView({ subsectionId, accessToken }: { subsectionId: string; accessToken: string }) {
    const [, navigate] = useLocation();
    const queryClient = useQueryClient();
    const { data, error, refetch, isFetchedAfterMount } = useSubsection(subsectionId, accessToken);
    const [pastStatic, setPastStatic] = useState(false);
    const [tutor, setTutor] = useState<TutorProgress>({ session: null, unlocked: false, busy: false });
    const [nonTutorDone, setNonTutorDone] = useState<{ progression: Progression | null; next: NextDestination | null } | null>(null);
    const [advancing, setAdvancing] = useState(false);
    const [advanceError, setAdvanceError] = useState<string | null>(null);
    const [celebrate, setCelebrate] = useState<Progression | null>(null);
    const sentinelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (data) document.title = `${data.subsection.subsection_title} | TECHCESS`;
    }, [data]);

    // State 1 → 2 of the Next button: reveal it once the static content has
    // been scrolled past. Sticky — scrolling back up doesn't hide it again.
    useEffect(() => {
        const el = sentinelRef.current;
        if (!el || pastStatic) return;
        const io = new IntersectionObserver((entries) => {
            if (entries.some((e) => e.isIntersecting)) setPastStatic(true);
        });
        io.observe(el);
        return () => io.disconnect();
    }, [data, pastStatic]);

    const onTutorProgress = useCallback((p: TutorProgress) => setTutor(p), []);

    if (error && !data)
        return (
            <AccessErrorState
                error={error}
                onRetry={() => refetch()}
                // Reaching a locked lesson by URL is the same situation as
                // tapping it in the chapter: offer the skip check.
                diagnosticFor={subsectionId}
            />
        );
    if (!data) return <PageSkeleton />;

    const { subsection, breadcrumb, progress, state } = data;
    const isTutor = TUTOR_TYPES.includes(subsection.subsection_type);
    const isCompleted = state.status === "completed";

    const goToDestination = (next: NextDestination | null) => {
        if (!next) {
            navigate(`/secondary/chapters/${breadcrumb.chapter_id}`);
            return;
        }
        const paidNext = data.next?.subsection_id === next.subsection_id ? data.next.requires_subscription : false;
        navigate(paidNext ? "/upgrade" : `/secondary/subsections/${next.subsection_id}`);
    };

    const finish = (progression: Progression | null, fallbackNext: NextDestination | null) => {
        // Progress changed: mark every cached listing stale without refetching
        // this page (it's about to unmount). Each page refetches on mount.
        queryClient.invalidateQueries({ queryKey: secondaryKeys.all, refetchType: "none" });
        if (progression?.chapter_completed) {
            setCelebrate(progression);
            return;
        }
        goToDestination(progression?.next ?? fallbackNext);
    };

    const handleNext = async () => {
        setAdvanceError(null);
        if (!isTutor) {
            finish(nonTutorDone?.progression ?? null, nonTutorDone?.next ?? data.next);
            return;
        }
        const session = tutor.session;
        if (!session || session.status !== "active") {
            // Completed earlier, no open review session: nothing to record.
            goToDestination(data.next);
            return;
        }
        setAdvancing(true);
        try {
            const res = await completeSession(session.session_id, accessToken);
            finish(res, data.next);
        } catch (err) {
            if (err instanceof SecondaryApiError && err.reason === "not_ready") {
                setAdvanceError("Your tutor wants to check your understanding a little more first — keep chatting.");
            } else {
                setAdvanceError(err instanceof Error ? err.message : "Couldn't continue. Please try again.");
            }
        } finally {
            setAdvancing(false);
        }
    };

    const unlocked = isTutor ? tutor.unlocked : nonTutorDone !== null;
    const buttonVisible = isTutor ? pastStatic || isCompleted : true;

    return (
        <main className="max-w-3xl mx-auto px-4 py-6 md:px-10 md:py-10 space-y-8">
            <nav aria-label="Breadcrumb">
                <ol className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
                    <li>
                        <button onClick={() => navigate(`/secondary/learn/${breadcrumb.subject_id}`)} className="hover:text-foreground min-h-[44px]">
                            {breadcrumb.subject_title}
                        </button>
                    </li>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                    <li>
                        <button onClick={() => navigate(`/secondary/chapters/${breadcrumb.chapter_id}`)} className="hover:text-foreground min-h-[44px] text-left">
                            {breadcrumb.chapter_title}
                        </button>
                    </li>
                    <ChevronRight className="w-3.5 h-3.5" aria-hidden />
                    <li className="text-foreground/80">{breadcrumb.section_label}</li>
                </ol>
            </nav>

            <header className="space-y-3">
                <p className="text-xs uppercase tracking-widest text-muted-foreground font-medium">
                    Section {progress.section_number} of {progress.section_count} · Subsection {progress.subsection_number} of {progress.subsection_count}
                </p>
                <h1 className="text-3xl md:text-[2.5rem] md:leading-tight font-semibold tracking-tight">{subsection.subsection_title}</h1>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full glass-chip text-muted-foreground">
                        {SUBSECTION_TYPE_LABEL[subsection.subsection_type]}
                    </span>
                    {isCompleted && (
                        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Completed
                        </span>
                    )}
                </div>
            </header>

            {isTutor ? (
                <>
                    <StaticContent content={subsection} />
                    <div ref={sentinelRef} aria-hidden className="h-px" />
                    {/* The lesson text can come from cache, but the chat must not:
                        a cached "active session" that has since completed would
                        auto-resume into a brand-new review session. */}
                    {isFetchedAfterMount ? (
                        <TutorChat
                            subsectionId={subsection.subsection_id}
                            accessToken={accessToken}
                            chatPrompt={subsection.chat_prompt_text}
                            isCompleted={isCompleted}
                            hasActiveSession={!!data.active_session}
                            hasPreviousSessions={data.has_previous_sessions}
                            onProgress={onTutorProgress}
                        />
                    ) : (
                        <div className="h-24 rounded-2xl bg-muted/30 animate-pulse" aria-hidden />
                    )}
                </>
            ) : subsection.subsection_type === "mini_quiz" ? (
                <MiniQuiz
                    subsectionId={subsection.subsection_id}
                    accessToken={accessToken}
                    onComplete={(progression, next) => setNonTutorDone({ progression, next })}
                />
            ) : (
                <EndOfChapter
                    chapterId={breadcrumb.chapter_id}
                    subsectionId={subsection.subsection_id}
                    accessToken={accessToken}
                    onComplete={(progression) => setNonTutorDone({ progression, next: progression?.next ?? data.next })}
                />
            )}

            <NextButton
                visible={buttonVisible}
                unlocked={unlocked}
                busy={advancing || (isTutor && tutor.busy)}
                next={(nonTutorDone?.progression?.next ?? nonTutorDone?.next ?? data.next) || null}
                hint={
                    isTutor
                        ? undefined
                        : subsection.subsection_type === "mini_quiz"
                            ? "Pass or see the solution for every question to continue"
                            : "Submit your working for every problem to continue"
                }
                onClick={handleNext}
            />
            {advanceError && (
                <p role="alert" className="text-sm text-center text-amber-700 dark:text-amber-400 -mt-4 pb-6">{advanceError}</p>
            )}

            {celebrate && (
                <ChapterCelebration
                    progression={celebrate}
                    onContinue={() => {
                        const next = celebrate.next;
                        setCelebrate(null);
                        goToDestination(next);
                    }}
                />
            )}
        </main>
    );
}
