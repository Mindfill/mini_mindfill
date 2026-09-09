import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { saveUniversityOnboarding } from "@/lib/api";
import { ScreenProps, STRUGGLE_TOPIC_OPTIONS } from "../utils";

export default function StruggleTopics({ accessToken, screenNumber, onNext, onBack }: ScreenProps) {
    const [selected, setSelected] = useState<string[]>([]);
    const [submitting, setSubmitting] = useState(false);

    const toggle = (topic: string) => {
        setSelected((prev) => (prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]));
    };

    const handleSubmit = async () => {
        if (selected.length === 0 || submitting) return;
        setSubmitting(true);
        try {
            await saveUniversityOnboarding(
                { screen: screenNumber, initial_struggle_topics: selected },
                accessToken
            );
            onNext({ struggleTopics: selected });
        } catch (err) {
            console.error("Failed to save struggle topics:", err);
            setSubmitting(false);
        }
    };

    return (
        <div className="text-center space-y-6">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                What's giving you the most trouble right now?
            </h1>

            <div className="grid grid-cols-2 gap-2.5">
                {STRUGGLE_TOPIC_OPTIONS.map((topic) => {
                    const active = selected.includes(topic);
                    return (
                        <button
                            key={topic}
                            onClick={() => toggle(topic)}
                            className={`flex items-center gap-2 p-3.5 rounded-xl border text-sm font-medium hover-elevate active-elevate-2 ${
                                active ? "border-amber bg-amber/5" : "border-border bg-card"
                            }`}
                        >
                            <div
                                className={`w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                    active ? "bg-amber border-amber" : "border-muted-foreground"
                                }`}
                            >
                                {active && <Check className="w-3 h-3 text-amber-foreground" />}
                            </div>
                            {topic}
                        </button>
                    );
                })}
            </div>

            <Button size="lg" disabled={selected.length === 0 || submitting} onClick={handleSubmit} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
