import { PHASE_LABELS, type Phase } from "@/lib/noteLessonApi";

/** Spec §3.3 — three equal segments; the tutor's `phase` drives it. */
export default function PhaseBar({ phase }: { phase: Phase }) {
    return (
        <div>
            <div
                className="grid grid-cols-3 gap-1"
                role="progressbar"
                aria-label="Lesson phase"
                aria-valuemin={1}
                aria-valuemax={3}
                aria-valuenow={phase}
                aria-valuetext={PHASE_LABELS[phase]}
            >
                {([1, 2, 3] as const).map((p) => (
                    <span
                        key={p}
                        className={`h-1 rounded-full ${p < phase ? "bg-primary" : p === phase ? "bg-primary/40" : "bg-muted"}`}
                    />
                ))}
            </div>
            <p className="mt-1.5 text-[11px] font-medium text-primary">{PHASE_LABELS[phase]}</p>
        </div>
    );
}
