import { CHIP_SETS, type ChipSet } from "@/lib/noteLessonApi";

/** Spec §3.5 — one-tap answers to the tutor's comprehension check. Tapping
 *  sends the chip text as a message; the row disappears once one is used. */
export default function ChipRow({
    chipSet,
    onPick,
    disabled,
}: {
    chipSet: ChipSet;
    onPick: (text: string) => void;
    disabled?: boolean;
}) {
    return (
        <div className="flex flex-wrap gap-2 pl-0.5" role="group" aria-label="Quick replies">
            {CHIP_SETS[chipSet].map((label, i) => (
                <button
                    key={label}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(label)}
                    className={`min-h-[36px] px-3.5 rounded-full text-[12px] font-medium border disabled:opacity-50 ${
                        i === 0
                            ? "bg-primary/10 text-primary border-primary/40 hover:bg-primary/15"
                            : "bg-muted text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                    }`}
                    style={{ borderWidth: "0.5px" }}
                >
                    {label}
                </button>
            ))}
        </div>
    );
}
