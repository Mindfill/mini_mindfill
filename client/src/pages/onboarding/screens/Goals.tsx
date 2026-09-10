import { useState } from "react";
import { Loader2, Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps, SECONDARY_GOAL_OPTIONS } from "../utils";

export default function Goals({ accessToken, screenNumber, collected, onNext, onBack }: ScreenProps) {
    const [selected, setSelected] = useState<string[]>(collected.lifeGoals || []);
    const [otherOpen, setOtherOpen] = useState(false);
    const [otherText, setOtherText] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const toggle = (goal: string) => {
        setSelected((prev) => (prev.includes(goal) ? prev.filter((g) => g !== goal) : [...prev, goal]));
    };

    const handleSubmit = () => {
        const goals = [...selected];
        if (otherOpen && otherText.trim()) goals.push(otherText.trim());
        if (goals.length === 0 || submitting) return;
        setSubmitting(true);
        saveSecondaryOnboarding({ screen: screenNumber, life_goals: goals }, accessToken).catch((err) => {
            console.error("Failed to save goals:", err);
        });
        setTimeout(() => onNext({ lifeGoals: goals }), ADVANCE_DELAY_MS);
    };

    const goalCount = selected.length + (otherOpen && otherText.trim() ? 1 : 0);

    return (
        <div className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                What are you trying to do with your life{collected.fullName ? `, ${collected.fullName}` : ""}?
            </h1>

            <div className="grid gap-2.5 text-left">
                {SECONDARY_GOAL_OPTIONS.map((goal) => {
                    const active = selected.includes(goal);
                    return (
                        <button
                            key={goal}
                            onClick={() => toggle(goal)}
                            className={`flex items-center gap-3 p-4 rounded-xl border hover-elevate active-elevate-2 ${
                                active ? "border-primary bg-primary/5" : "border-border bg-card"
                            }`}
                        >
                            <div
                                className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                    active ? "bg-primary border-primary" : "border-muted-foreground"
                                }`}
                            >
                                {active && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                            </div>
                            <span className="text-sm font-medium">{goal}</span>
                        </button>
                    );
                })}

                <button
                    onClick={() => setOtherOpen((o) => !o)}
                    className={`flex items-center gap-3 p-4 rounded-xl border hover-elevate active-elevate-2 ${
                        otherOpen ? "border-primary bg-primary/5" : "border-border bg-card"
                    }`}
                >
                    <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            otherOpen ? "bg-primary border-primary" : "border-muted-foreground"
                        }`}
                    >
                        {otherOpen && <Check className="w-3.5 h-3.5 text-primary-foreground" />}
                    </div>
                    <span className="text-sm font-medium">Other — I'll tell you myself</span>
                </button>
                {otherOpen && (
                    <Input
                        autoFocus
                        value={otherText}
                        onChange={(e) => setOtherText(e.target.value)}
                        placeholder="What's your goal?"
                        disabled={submitting}
                    />
                )}
            </div>

            <Button size="lg" disabled={goalCount === 0 || submitting} onClick={handleSubmit} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
