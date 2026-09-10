import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, saveUniversityOnboarding, UnderAgeError, UserType } from "@/lib/api";
import { ScreenProps, calculateAge, ageResponse } from "../utils";

interface DobProps extends ScreenProps {
    userType: "secondary" | "university";
}

export default function Dob({ accessToken, screenNumber, collected, onNext, onBack, userType }: DobProps) {
    const [dob, setDob] = useState(collected.dateOfBirth || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [response, setResponse] = useState<string | null>(null);

    const age = dob ? calculateAge(dob) : null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!dob || submitting) return;
        setSubmitting(true);
        setError(null);
        setResponse(null);
        try {
            const payload = { screen: screenNumber, date_of_birth: dob };
            if (userType === "secondary") {
                await saveSecondaryOnboarding(payload, accessToken);
            } else {
                await saveUniversityOnboarding(payload, accessToken);
            }
            const computedAge = calculateAge(dob);
            setResponse(ageResponse(computedAge, userType));
            setTimeout(() => onNext({ dateOfBirth: dob }), 600);
        } catch (err) {
            if (err instanceof UnderAgeError) {
                setError("You need to be 13 or older to use Techcess. Come back when you are — we'll be here.");
            } else {
                console.error("Failed to save date of birth:", err);
                setError("Couldn't save that — please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                How old are you{collected.fullName ? `, ${collected.fullName}` : ""}?
            </h1>

            <Input
                autoFocus
                type="date"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                className="text-lg h-12"
                disabled={submitting || !!response}
            />

            {age !== null && !error && (
                <p className="text-sm text-muted-foreground">You're {age} years old.</p>
            )}

            {response && <p className="text-primary font-medium fade-in">{response}</p>}
            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" size="lg" disabled={!dob || submitting || !!response} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </form>
    );
}
