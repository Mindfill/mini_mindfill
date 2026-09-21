import { useState } from "react";
import { saveSecondaryOnboarding, saveUniversityOnboarding } from "@/lib/api";
import { applyDyslexiaFont } from "@/lib/dyslexiaFont";
import { ScreenProps } from "../utils";

interface DyslexiaProps extends ScreenProps {
    userType: "secondary" | "university";
}

/**
 * Asks whether the student is dyslexic and switches the whole app to
 * OpenDyslexic if so. Placed early in the flow so the rest of onboarding is
 * already in the right font, which also shows the student it worked.
 *
 * The font applies immediately on click; the save is best-effort in the
 * background (same pattern as Sentiment), so a slow or failed request never
 * blocks the answer taking effect.
 */
export default function Dyslexia({ accessToken, screenNumber, onNext, onBack, userType }: DyslexiaProps) {
    const [picked, setPicked] = useState<boolean | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handlePick = (hasDyslexia: boolean) => {
        if (submitting) return;
        setSubmitting(true);
        setPicked(hasDyslexia);

        applyDyslexiaFont(hasDyslexia);

        const payload = { screen: screenNumber, has_dyslexia: hasDyslexia };
        const save = userType === "secondary"
            ? saveSecondaryOnboarding(payload, accessToken)
            : saveUniversityOnboarding(payload, accessToken);
        save.catch((err) => console.error("Failed to save dyslexia preference:", err));

        setTimeout(() => onNext({ hasDyslexia }), 700);
    };

    return (
        <div className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Are you dyslexic?
            </h1>

            <p className="text-sm text-muted-foreground">
                If you are, we'll switch the whole app to a font designed to be easier to read.
                You can change this any time from the sidebar.
            </p>

            <div className="grid gap-2.5 text-left">
                <button
                    onClick={() => handlePick(true)}
                    disabled={submitting}
                    aria-pressed={picked === true}
                    className={`p-4 rounded-xl border text-sm font-medium hover-elevate active-elevate-2 disabled:opacity-60 ${
                        picked === true ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                    data-testid="button-dyslexia-yes"
                >
                    Yes — use the easier-to-read font
                </button>
                <button
                    onClick={() => handlePick(false)}
                    disabled={submitting}
                    aria-pressed={picked === false}
                    className={`p-4 rounded-xl border text-sm font-medium hover-elevate active-elevate-2 disabled:opacity-60 ${
                        picked === false ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                    data-testid="button-dyslexia-no"
                >
                    No — keep the standard font
                </button>
            </div>

            <p className="text-xs text-muted-foreground">
                This is just a reading preference — it doesn't change your lessons, and we don't
                treat it as a medical record.
            </p>

            {picked === true && (
                <p className="text-primary font-medium fade-in">Done — this is the new font.</p>
            )}

            <button onClick={onBack} disabled={submitting} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
