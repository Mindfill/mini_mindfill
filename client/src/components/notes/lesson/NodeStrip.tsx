import { useEffect, useRef } from "react";
import { Check } from "lucide-react";
import type { BoardSection } from "@/lib/noteLessonApi";

/**
 * Spec §3.2 — one pill per section, horizontally scrollable, so the student
 * always knows where they are. Colours are the platform's tokens (David: keep
 * the current theme; only the signal colours are fixed).
 */
export default function NodeStrip({
    sections,
    activeIndex,
    onSelect,
}: {
    sections: BoardSection[];
    activeIndex: number;
    onSelect: (sectionIndex: number) => void;
}) {
    const activeRef = useRef<HTMLButtonElement>(null);

    // Keep the current node in view on long notes.
    useEffect(() => {
        activeRef.current?.scrollIntoView({ block: "nearest", inline: "center" });
    }, [activeIndex]);

    return (
        <nav aria-label="Sections" className="-mx-4 px-4 overflow-x-auto [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            <ol className="flex gap-1.5 w-max py-0.5">
                {sections.map((s, i) => {
                    const active = s.section_index === activeIndex;
                    // No locked state: every section opens, in any order (David).
                    const tone = active
                        ? "bg-primary/10 text-primary border-primary/50"
                        : s.state === "done"
                          ? "bg-primary/5 text-foreground border-primary/25"
                          : "bg-muted text-muted-foreground border-border";
                    return (
                        <li key={s.section_index}>
                            <button
                                ref={active ? activeRef : undefined}
                                type="button"
                                onClick={() => !active && onSelect(s.section_index)}
                                aria-current={active ? "step" : undefined}
                                title={s.title}
                                aria-label={`Section ${i + 1}: ${s.title}${s.state === "done" ? " (complete)" : ""}`}
                                className={`h-8 min-w-[44px] px-3 rounded-full border text-[11px] font-semibold tabular-nums inline-flex items-center gap-1 hover:border-primary/60 ${tone}`}
                            >
                                {s.state === "done" && !active && <Check className="w-3 h-3 text-primary" aria-hidden="true" />}
                                S{i + 1}
                                {active && <span aria-hidden="true">●</span>}
                            </button>
                        </li>
                    );
                })}
            </ol>
        </nav>
    );
}
