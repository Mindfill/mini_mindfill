import { useEffect, useState } from "react";
import MarkdownLatex from "@/components/ui/markdown-latex";
import type { Signal } from "@/lib/noteLessonApi";

const TAG_LABEL: Record<"green" | "orange" | "red", string> = {
    green: "Correct",
    orange: "Worth revisiting",
    red: "Misconception",
};

const TAG_VISIBLE_MS = 2500;

/**
 * Spec §4 — a student message carrying its comprehension signal.
 *
 * Resting glow: left border + faint tint in the signal colour, permanently,
 * so the conversation reads as a comprehension history. `fresh` is true only
 * for the message whose signal just arrived: that one gets the PCB pulse and
 * the tag, which fades after 2.5s and never comes back (history renders it at
 * opacity 0 so layout doesn't shift).
 *
 * `pending` — sent, tutor hasn't assessed it yet.
 */
export default function StudentMessage({
    content,
    signal,
    fresh = false,
    pending = false,
}: {
    content: string;
    signal: Signal | undefined;
    fresh?: boolean;
    pending?: boolean;
}) {
    const key = signal ?? "null";
    const [tagVisible, setTagVisible] = useState(fresh);

    useEffect(() => {
        if (!fresh || !signal) return;
        setTagVisible(true);
        const t = setTimeout(() => setTagVisible(false), TAG_VISIBLE_MS);
        return () => clearTimeout(t);
    }, [fresh, signal]);

    return (
        <div className="flex flex-col items-end w-full">
            <div
                className="min-w-0 max-w-[85%] px-3.5 py-2.5 text-[13px] leading-[1.5] text-foreground"
                style={{
                    borderLeft: `2.5px solid var(--sig-${key})`,
                    background: `var(--sig-${key}-bg)`,
                    borderRadius: "12px 4px 12px 12px",
                    opacity: pending ? 0.85 : 1,
                }}
            >
                <MarkdownLatex content={content} />
            </div>

            {signal && (
                <div className="flex items-center gap-2 mt-1.5 max-w-[85%]">
                    <svg width="60" height="10" viewBox="0 0 80 10" aria-hidden="true" className="shrink-0">
                        <path d="M3,5 L77,5" stroke="var(--sig-track)" strokeWidth="1.5" fill="none" />
                        {fresh && (
                            <path
                                d="M3,5 L77,5"
                                stroke={`var(--sig-${signal})`}
                                strokeWidth="2"
                                strokeLinecap="round"
                                fill="none"
                                className="pcb-pulse"
                            />
                        )}
                    </svg>
                    <span
                        className="signal-tag text-[10px] font-medium px-2 py-px rounded-full"
                        style={{
                            opacity: tagVisible ? 1 : 0,
                            background: `var(--sig-${signal}-tag-bg)`,
                            color: `var(--sig-${signal}-tag-text)`,
                            border: `0.5px solid var(--sig-${signal})`,
                        }}
                        // Screen readers get the assessment once, when it's new.
                        aria-live={fresh ? "polite" : undefined}
                        aria-hidden={!fresh}
                    >
                        {TAG_LABEL[signal]}
                    </span>
                </div>
            )}
        </div>
    );
}
