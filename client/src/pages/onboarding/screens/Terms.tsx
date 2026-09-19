import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { acceptOnboardingTerms, fetchProfile } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

export default function Terms({ accessToken, onNext, onBack }: ScreenProps) {
    const [checked, setChecked] = useState(false);
    // Separate opt-in, unticked by default — never implied by accepting terms.
    const [trainingConsent, setTrainingConsent] = useState(false);
    // Only adults (by the date of birth given earlier) see the opt-in at all.
    // Stays false if the profile can't be read — the safe default.
    const [canOptIn, setCanOptIn] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!accessToken) return;
        fetchProfile(accessToken)
            .then((p) => setCanOptIn(p.training_consent_eligible))
            .catch(() => setCanOptIn(false));
    }, [accessToken]);

    // Checking the box is just agreement — accepting terms is still its own
    // explicit Continue click, so nobody can later say they were rushed
    // through it.
    const handleSubmit = () => {
        if (!checked || submitting) return;
        setSubmitting(true);
        setError(null);
        acceptOnboardingTerms(accessToken, canOptIn && trainingConsent)
            .then(() => {
                setTimeout(() => onNext(), ADVANCE_DELAY_MS);
            })
            .catch((err) => {
                console.error("Failed to accept terms:", err);
                setError("Couldn't save that — please try again.");
                setSubmitting(false);
            });
    };

    return (
        <div className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                One last thing
            </h1>

            <div className="space-y-3">
                <label className="flex items-start gap-3 text-left bg-card border border-border rounded-2xl p-5 cursor-pointer">
                    <Checkbox
                        checked={checked}
                        onCheckedChange={(v) => setChecked(v === true)}
                        className="mt-0.5"
                        disabled={submitting}
                    />
                    <span className="text-sm text-foreground/90">
                        I agree to the{" "}
                        <Link href="/terms" target="_blank" className="underline hover:text-foreground">
                            Terms of Service
                        </Link>{" "}
                        and{" "}
                        <Link href="/privacy" target="_blank" className="underline hover:text-foreground">
                            Privacy Policy
                        </Link>
                        , and confirm that all information I've provided is accurate. If I am 17 or younger, I
                        confirm that my parent or legal guardian has given their consent for me to use TECHCESS.
                    </span>
                </label>

                {canOptIn && (
                    <label className="flex items-start gap-3 text-left bg-card border border-border rounded-2xl p-5 cursor-pointer">
                        <Checkbox
                            checked={trainingConsent}
                            onCheckedChange={(v) => setTrainingConsent(v === true)}
                            className="mt-0.5"
                            disabled={submitting}
                        />
                        <span className="text-sm text-foreground/90">
                            <span className="font-medium">Optional:</span> when I delete a note, TECHCESS may keep an
                            anonymised copy of my tutor conversations to improve the tutor. My name, email and account
                            are removed from it, and it can't be traced back to me. I can change this anytime in my
                            profile.
                        </span>
                    </label>
                )}
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button size="lg" disabled={!checked || submitting} onClick={handleSubmit} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
