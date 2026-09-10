import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, saveUniversityOnboarding, saveParentOnboarding, UserType } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

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

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = fullName.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        const save =
            userType === "secondary"
                ? saveSecondaryOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken)
                : userType === "university"
                ? saveUniversityOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken)
                : saveParentOnboarding({ screen: screenNumber, full_name: trimmed }, accessToken);
        save.catch((err) => console.error("Failed to save name:", err));
        setTimeout(() => onNext({ fullName: trimmed }), ADVANCE_DELAY_MS);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {COPY[userType]}
            </h1>

            <Input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                className="text-lg h-12"
                disabled={submitting}
            />

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
