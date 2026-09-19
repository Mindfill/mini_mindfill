import { useEffect, useRef } from "react";
import { Check, Lock } from "lucide-react";
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
                    const locked = s.state === "locked";
                    const tone = active
                        ? "bg-primary/10 text-primary border-primary/50"
                        : s.state === "done"
                          ? "bg-primary/5 text-foreground border-primary/25"
                          : locked
                            ? "bg-muted text-muted-foreground border-border opacity-30"
                            : "bg-muted text-muted-foreground border-border";
                    return (
                        <li key={s.section_index}>
                            <button
                                ref={active ? activeRef : undefined}
                                type="button"
                                // Locked does nothing — no error state (spec §3.2).
                                onClick={() => !locked && !active && onSelect(s.section_index)}
                                aria-disabled={locked}
                                aria-current={active ? "step" : undefined}
                                title={s.title}
                                aria-label={`Section ${i + 1}: ${s.title}${s.state === "done" ? " (complete)" : locked ? " (locked)" : ""}`}
                                className={`h-8 min-w-[44px] px-3 rounded-full border text-[11px] font-semibold tabular-nums inline-flex items-center gap-1 ${tone} ${
                                    locked ? "cursor-default" : "hover:border-primary/60"
                                }`}
                            >
                                {s.state === "done" && !active && <Check className="w-3 h-3 text-primary" aria-hidden="true" />}
                                {locked && <Lock className="w-2.5 h-2.5" aria-hidden="true" />}
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
