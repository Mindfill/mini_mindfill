import { Check, Layers } from "lucide-react";
import MarkdownLatex from "@/components/ui/markdown-latex";

export interface PlanSection {
    id: string;
    title: string;
    summary?: string;
}

interface SectionSelectorProps {
    sections: PlanSection[];
    selected: string[];
    onChange: (ids: string[]) => void;
    disabled?: boolean;
}

const chipClass = (active: boolean) =>
    `flex items-center gap-1.5 flex-shrink-0 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wide transition-all border ${
        active
            ? "bg-primary text-primary-foreground border-primary shadow-sm"
            : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-muted-foreground/40"
    }`;

/**
 * Horizontal, togglable chips derived from a note's lesson-plan sections.
 * An empty `selected` array means "all sections" (the backend focuses on
 * everything when no sections are passed).
 */
export default function SectionSelector({
    sections,
    selected,
    onChange,
    disabled = false,
}: SectionSelectorProps) {
    if (sections.length === 0) return null;

    const allActive = selected.length === 0;

    const toggle = (id: string) => {
        if (disabled) return;
        if (selected.includes(id)) {
            onChange(selected.filter((s) => s !== id));
        } else {
            onChange([...selected, id]);
        }
    };

    return (
        <div className="border-b border-border/50 bg-background px-4 py-2.5">
            <div className="max-w-3xl mx-auto flex items-center gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden">
                <span className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest uppercase text-muted-foreground flex-shrink-0 pr-1">
                    <Layers className="w-3.5 h-3.5" /> Focus
                </span>

                <button
                    type="button"
                    onClick={() => onChange([])}
                    disabled={disabled}
                    className={chipClass(allActive)}
                >
                    All sections
                </button>

                {sections.map((s) => {
                    const active = selected.includes(s.id);
                    return (
                        <button
                            key={s.id}
                            type="button"
                            onClick={() => toggle(s.id)}
                            disabled={disabled}
                            title={s.summary}
                            className={chipClass(active)}
                        >
                            {active && <Check className="w-3 h-3 flex-shrink-0" />}
                            <MarkdownLatex inline content={s.title} className="truncate max-w-[180px] inline-block align-middle" />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
