import { useState } from "react";
import { saveSecondaryOnboarding, saveUniversityOnboarding } from "@/lib/api";
import { ScreenProps, SENTIMENT_OPTIONS } from "../utils";

interface SentimentProps extends ScreenProps {
    userType: "secondary" | "university";
}

export default function Sentiment({ accessToken, screenNumber, onNext, onBack, userType }: SentimentProps) {
    const [picked, setPicked] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const handlePick = async (value: string) => {
        if (submitting) return;
        setSubmitting(true);
        setPicked(value);
        try {
            const payload = { screen: screenNumber, education_sentiment: value };
            if (userType === "secondary") {
                await saveSecondaryOnboarding(payload, accessToken);
            } else {
                await saveUniversityOnboarding(payload, accessToken);
            }
            setTimeout(() => onNext({ educationSentiment: value }), 900);
        } catch (err) {
            console.error("Failed to save sentiment:", err);
            setPicked(null);
            setSubmitting(false);
        }
    };

    const response = SENTIMENT_OPTIONS.find((o) => o.value === picked)?.response;

    return (
        <div className="text-center space-y-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Real talk — is school actually worth it?
            </h1>

            <div className="grid gap-2.5 text-left">
                {SENTIMENT_OPTIONS.map((opt) => (
                    <button
                        key={opt.value}
                        onClick={() => handlePick(opt.value)}
                        disabled={submitting}
                        className={`p-4 rounded-xl border text-sm font-medium hover-elevate active-elevate-2 disabled:opacity-60 ${
                            picked === opt.value ? "border-amber bg-amber/5" : "border-border bg-card"
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>

            <p className="text-xs text-muted-foreground">
                Your answer is completely anonymous. We genuinely want to know.
            </p>

            {response && <p className="text-amber font-medium fade-in">{response}</p>}

            <button onClick={onBack} disabled={submitting} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
