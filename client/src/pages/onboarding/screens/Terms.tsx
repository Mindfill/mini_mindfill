import { useState } from "react";
import { Link } from "wouter";
import { Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { acceptOnboardingTerms } from "@/lib/api";
import { ScreenProps } from "../utils";

export default function Terms({ accessToken, onNext, onBack }: ScreenProps) {
    const [checked, setChecked] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async () => {
        if (!checked || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            await acceptOnboardingTerms(accessToken);
            onNext();
        } catch (err) {
            console.error("Failed to accept terms:", err);
            setError("Couldn't save that — please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="text-center space-y-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                One last thing
            </h1>

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
                    </Link>{" "}
                    and confirm that all information I've provided is accurate.
                </span>
            </label>

            {error && <p className="text-sm text-red-400">{error}</p>}

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
