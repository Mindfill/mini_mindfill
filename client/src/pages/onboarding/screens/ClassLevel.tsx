import { useState } from "react";
import { Loader2 } from "lucide-react";
import { saveSecondaryOnboarding } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

const LEVELS = ["SS1", "SS2", "SS3"] as const;

export default function ClassLevel({ accessToken, screenNumber, onNext, onBack }: ScreenProps) {
    const [submitting, setSubmitting] = useState<string | null>(null);

    const handlePick = (level: (typeof LEVELS)[number]) => {
        if (submitting) return;
        setSubmitting(level);
        saveSecondaryOnboarding({ screen: screenNumber, secondary_class_level: level }, accessToken).catch((err) => {
            console.error("Failed to save class level:", err);
        });
        setTimeout(() => onNext({ secondaryClassLevel: level }), ADVANCE_DELAY_MS);
    };

    return (
        <div className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                What class are you in?
            </h1>

            <div className="grid grid-cols-3 gap-3">
                {LEVELS.map((level) => (
                    <button
                        key={level}
                        onClick={() => handlePick(level)}
                        disabled={submitting !== null}
                        className="flex flex-col items-center justify-center gap-2 aspect-square rounded-2xl border border-border bg-card text-xl font-bold hover-elevate active-elevate-2 disabled:opacity-60"
                    >
                        {submitting === level ? <Loader2 className="w-5 h-5 animate-spin" /> : level}
                    </button>
                ))}
            </div>

            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
