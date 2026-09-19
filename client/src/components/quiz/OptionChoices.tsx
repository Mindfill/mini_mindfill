import MarkdownLatex from "@/components/ui/markdown-latex";
import type { QuizOption } from "@/lib/quizOptions";

/**
 * Tappable multiple-choice options with capital letters — the same shape the
 * university note quiz uses, so every quiz in the app looks and behaves alike.
 * Each option is a full-width target (comfortable on a phone) and keeps its
 * markdown/LaTeX.
 */
export default function OptionChoices({
    options,
    selectedLetter,
    onSelect,
    disabled = false,
    correctLetter,
    name,
}: {
    options: QuizOption[];
    selectedLetter: string | null;
    onSelect: (option: QuizOption) => void;
    disabled?: boolean;
    /** When set, marks the right answer (and a wrong pick) after submission. */
    correctLetter?: string | null;
    name: string;
}) {
    return (
        <div role="radiogroup" aria-label="Answer options" className="space-y-3">
            {options.map((option) => {
                const isSelected = selectedLetter === option.letter;
                const isCorrect = !!correctLetter && correctLetter === option.letter;
                const isWrongPick = !!correctLetter && isSelected && !isCorrect;

                let tone = "border-border hover:bg-muted/60 text-foreground/90";
                if (correctLetter) {
                    if (isCorrect) tone = "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400";
                    else if (isWrongPick) tone = "border-red-500/50 bg-red-500/10 text-red-700 dark:text-red-400";
                    else tone = "border-border opacity-60 text-muted-foreground";
                } else if (isSelected) {
                    tone = "border-primary bg-primary/10 text-foreground";
                }

                return (
                    <button
                        key={`${name}-${option.letter}`}
                        type="button"
                        role="radio"
                        aria-checked={isSelected}
                        disabled={disabled}
                        onClick={() => onSelect(option)}
                        className={`w-full text-left p-4 rounded-2xl border transition-colors flex items-start gap-3 min-h-[56px] disabled:cursor-not-allowed ${tone}`}
                    >
                        <span
                            aria-hidden
                            className={`w-7 h-7 rounded-full border flex items-center justify-center text-sm font-semibold shrink-0 ${
                                isSelected && !correctLetter ? "border-primary text-primary" : "border-border text-muted-foreground"
                            }`}
                        >
                            {option.letter}
                        </span>
                        <span className="sr-only">Option {option.letter}: </span>
                        <div className="flex-1 text-[15px]">
                            <MarkdownLatex content={option.text} className="text-inherit [&_p]:mb-0" />
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
