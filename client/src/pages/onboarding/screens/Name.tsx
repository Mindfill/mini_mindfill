import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, saveUniversityOnboarding, saveParentOnboarding, UserType } from "@/lib/api";
import { ScreenProps } from "../utils";

interface NameProps extends ScreenProps {
    userType: UserType;
}

const COPY: Record<UserType, string> = {
    secondary: "Before we start — what do you go by?",
    university: "Before we start — what do you go by?",
    parent: "What should we call you?",
};

export default function Name({ accessToken, screenNumber, collected, onNext, onBack, userType }: NameProps) {
    const [fullName, setFullName] = useState(collected.fullName || "");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = fullName.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        setError(null);
        try {
            if (userType === "secondary") {
                await saveSecondaryOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken);
            } else if (userType === "university") {
                await saveUniversityOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken);
            } else {
                await saveParentOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken);
            }
            onNext({ fullName: trimmed });
        } catch (err) {
            console.error("Failed to save name:", err);
            setError("Couldn't save that — please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="text-center space-y-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {COPY[userType]}
            </h1>

            <Input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="text-center text-lg h-12"
                disabled={submitting}
            />

            {error && <p className="text-sm text-red-400">{error}</p>}

            <Button type="submit" size="lg" disabled={!fullName.trim() || submitting} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </form>
    );
}
