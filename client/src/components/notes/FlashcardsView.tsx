import { useEffect, useState } from "react";
import {
    fetchQuizSections,
    fetchFlashcards,
    generateFlashcards,
    type Flashcard,
    type QuizSectionOption,
} from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import {
    Loader2,
    Sparkles,
    Check,
    ChevronLeft,
    ChevronRight,
    RotateCcw,
    ArrowLeft,
    Layers,
} from "lucide-react";

interface FlashcardsViewProps {
    noteId: string;
    accessToken: string;
}

/**
 * Flashcards for a note: pick sections (from GET /quiz/{note_id}), fetch cards
 * from POST /notes/{note_id}/flashcards, then flip through them.
 */
export default function FlashcardsView({ noteId, accessToken }: FlashcardsViewProps) {
    const [cards, setCards] = useState<Flashcard[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Section picker
    const [sectionOptions, setSectionOptions] = useState<QuizSectionOption[]>([]);
    const [selectedSectionIds, setSelectedSectionIds] = useState<string[]>([]);
    const [loadingSections, setLoadingSections] = useState(false);
    const [sectionsError, setSectionsError] = useState<string | null>(null);

    // Viewer
    const [index, setIndex] = useState(0);
    const [flipped, setFlipped] = useState(false);

    const showPicker = cards.length === 0;

    useEffect(() => {
        if (!showPicker || !noteId || !accessToken) return;
        let cancelled = false;
        setLoadingSections(true);
        setSectionsError(null);
        fetchQuizSections(noteId, accessToken)
            .then((secs) => {
                if (!cancelled) setSectionOptions(secs);
            })
            .catch((err) => {
                console.error("Failed to load sections:", err);
                if (!cancelled) setSectionsError("Couldn't load sections. Make sure the note has been onboarded first.");
            })
            .finally(() => {
                if (!cancelled) setLoadingSections(false);
            });
        return () => {
            cancelled = true;
        };
    }, [showPicker, noteId, accessToken]);

    const toggleSection = (id: string) =>
        setSelectedSectionIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));

    const allSelected = sectionOptions.length > 0 && selectedSectionIds.length === sectionOptions.length;
    const toggleAll = () => setSelectedSectionIds(allSelected ? [] : sectionOptions.map((s) => s.id));

    const start = async (regenerate = false) => {
        // The flashcards endpoint expects integer section ids (not titles).
        const ids = selectedSectionIds.map(Number).filter((n) => !Number.isNaN(n));
        if (ids.length === 0 || loading) return;
        setLoading(true);
        setError(null);
        try {
            const res = regenerate
                ? await generateFlashcards(noteId, ids, accessToken)
                : await fetchFlashcards(noteId, ids, accessToken);
            setCards(res.flashcards || []);
            setIndex(0);
            setFlipped(false);
        } catch (err) {
            console.error("Failed to load flashcards:", err);
            setError("Couldn't load flashcards. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const go = (delta: number) => {
        setFlipped(false);
        setIndex((i) => Math.min(Math.max(i + delta, 0), cards.length - 1));
    };

    // ── Loading (fetch / generate) ────────────────────────────────────────
    if (loading) {
        return (
            <div className="max-w-2xl mx-auto py-20 px-6 flex flex-col items-center text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                    <Loader2 className="w-8 h-8 text-primary animate-spin" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">Preparing your flashcards…</h2>
                <p className="text-muted-foreground max-w-sm leading-relaxed">
                    This can take up to <span className="font-semibold text-foreground">20 seconds</span> the first time.
                </p>
            </div>
        );
    }

    // ── Section picker ────────────────────────────────────────────────────
    if (showPicker) {
        return (
            <div className="max-w-2xl mx-auto py-12 px-6">
                <div className="flex flex-col items-center text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
                        <Layers className="w-8 h-8 text-primary" />
                    </div>
                    <h2 className="text-xl font-bold text-foreground mb-2">Study with flashcards</h2>
                    <p className="text-muted-foreground max-w-sm leading-relaxed">
                        Choose the sections you want to review.
                    </p>
                </div>

                {loadingSections ? (
                    <div className="flex justify-center py-10">
                        <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    </div>
                ) : sectionsError ? (
                    <div className="text-center bg-red-500/10 border border-red-500/20 rounded-2xl p-6">
                        <p className="text-red-400/90 text-sm">{sectionsError}</p>
                    </div>
                ) : sectionOptions.length === 0 ? (
                    <div className="text-center bg-card border border-border rounded-2xl p-6">
                        <p className="text-muted-foreground text-sm">No sections found for this note.</p>
                    </div>
                ) : (
                    <>
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-[11px] font-bold tracking-widest uppercase text-muted-foreground">
                                {selectedSectionIds.length} selected
                            </span>
                            <button onClick={toggleAll} className="text-xs font-semibold text-primary hover:underline">
                                {allSelected ? "Clear all" : "Select all"}
                            </button>
                        </div>

                        <div className="space-y-2 mb-8">
                            {sectionOptions.map((s) => {
                                const active = selectedSectionIds.includes(s.id);
                                return (
                                    <button
                                        key={s.id}
                                        onClick={() => toggleSection(s.id)}
                                        className={`w-full flex items-center gap-3 text-left p-4 rounded-xl border transition-all ${
                                            active
                                                ? "border-primary bg-primary/5 text-foreground"
                                                : "border-border bg-card text-foreground/90 hover:border-muted-foreground/40"
                                        }`}
                                    >
                                        <span
                                            className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border ${
                                                active ? "bg-primary border-primary text-primary-foreground" : "border-border"
                                            }`}
                                        >
                                            {active && <Check className="w-3.5 h-3.5" />}
                                        </span>
                                        <span className="text-sm font-medium">
                                            <span className="text-muted-foreground mr-1">{s.id}.</span>
                                            {s.title}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>

                        {error && (
                            <p className="text-red-400/90 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 mb-4 text-center">
                                {error}
                            </p>
                        )}

                        <button
                            onClick={() => start(false)}
                            disabled={selectedSectionIds.length === 0}
                            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                        >
                            <Sparkles className="w-4 h-4" /> Start Flashcards
                        </button>
                    </>
                )}
            </div>
        );
    }

    // ── Flashcard viewer ──────────────────────────────────────────────────
    const card = cards[index];

    return (
        <div className="w-full max-w-2xl mx-auto py-8 px-6 pb-24 relative">
            <style
                dangerouslySetInnerHTML={{
                    __html: `
                    .fc-perspective { perspective: 1200px; }
                    .fc-preserve-3d { transform-style: preserve-3d; }
                    .fc-backface { backface-visibility: hidden; -webkit-backface-visibility: hidden; }
                    .fc-flip { transform: rotateY(180deg); }
                `,
                }}
            />

            <button
                onClick={() => setCards([])}
                className="absolute top-0 right-6 flex items-center text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-1" /> New set
            </button>

            {/* Progress */}
            <div className="w-full max-w-2xl mx-auto mb-6">
                <div className="flex justify-between text-xs text-muted-foreground mb-2 font-medium tracking-wider">
                    <span>CARD {index + 1} OF {cards.length}</span>
                    <span className="uppercase text-muted-foreground/70">Tap card to flip</span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary transition-all duration-500 ease-out"
                        style={{ width: `${((index + 1) / cards.length) * 100}%` }}
                    />
                </div>
            </div>

            {/* Card */}
            <div className="fc-perspective w-full h-80 mb-6">
                <div
                    className={`relative w-full h-full transition-transform duration-500 fc-preserve-3d cursor-pointer ${flipped ? "fc-flip" : ""}`}
                    onClick={() => setFlipped((f) => !f)}
                >
                    {/* Front — question */}
                    <div className="absolute inset-0 fc-backface flex flex-col items-center justify-center p-8 bg-card border border-border rounded-2xl shadow-xl overflow-y-auto">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-muted-foreground/60 mb-4">Question</span>
                        <MarkdownLatex content={card.question} className="text-lg text-foreground font-medium text-center" />
                    </div>
                    {/* Back — answer */}
                    <div className="absolute inset-0 fc-backface fc-flip flex flex-col items-center justify-center p-8 bg-card border border-primary/30 rounded-2xl shadow-xl overflow-y-auto">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-primary/70 mb-4">Answer</span>
                        <MarkdownLatex content={card.answer} className="text-lg text-foreground text-center" />
                    </div>
                </div>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between gap-3">
                <button
                    onClick={() => go(-1)}
                    disabled={index === 0}
                    className="flex items-center gap-1 px-5 py-2.5 rounded-xl border border-border text-foreground/90 hover:bg-muted transition-colors disabled:opacity-40"
                >
                    <ChevronLeft className="w-4 h-4" /> Prev
                </button>

                <button
                    onClick={() => start(true)}
                    className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    title="Generate a fresh set"
                >
                    <RotateCcw className="w-3.5 h-3.5" /> New questions
                </button>

                <button
                    onClick={() => go(1)}
                    disabled={index >= cards.length - 1}
                    className="flex items-center gap-1 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-colors disabled:opacity-40"
                >
                    Next <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}
