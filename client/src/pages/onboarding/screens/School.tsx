import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, searchSchools, SchoolResult } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

export default function School({ accessToken, screenNumber, collected, onNext, onBack }: ScreenProps) {
    const [schoolName, setSchoolName] = useState(collected.schoolName || "");
    const [suggestions, setSuggestions] = useState<SchoolResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const debounceRef = useRef<number>();

    useEffect(() => {
        window.clearTimeout(debounceRef.current);
        if (schoolName.trim().length < 2) {
            setSuggestions([]);
            return;
        }
        debounceRef.current = window.setTimeout(async () => {
            try {
                const results = await searchSchools(schoolName.trim(), accessToken);
                setSuggestions(results);
            } catch (err) {
                console.error("School search failed:", err);
            }
        }, 250);
        return () => window.clearTimeout(debounceRef.current);
    }, [schoolName, accessToken]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = schoolName.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        saveSecondaryOnboarding({ screen: screenNumber, school_name: trimmed }, accessToken).catch((err) => {
            console.error("Failed to save school:", err);
        });
        setTimeout(() => onNext({ schoolName: trimmed }), ADVANCE_DELAY_MS);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Where do you go to school?
            </h1>

            <div className="relative text-left">
                <Input
                    autoFocus
                    value={schoolName}
                    onChange={(e) => {
                        setSchoolName(e.target.value);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => window.setTimeout(() => setShowSuggestions(false), 150)}
                    placeholder="School name"
                    className="text-lg h-12"
                    disabled={submitting}
                />
                {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
                        {suggestions.map((s) => (
                            <button
                                key={s.id}
                                type="button"
                                onClick={() => {
                                    setSchoolName(s.school_name);
                                    setShowSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-2.5 hover-elevate"
                            >
                                <p className="text-sm font-medium">{s.school_name}</p>
                                {(s.city || s.state) && (
                                    <p className="text-xs text-muted-foreground">
                                        {[s.city, s.state].filter(Boolean).join(", ")}
                                    </p>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <p className="text-xs text-muted-foreground">Don't worry if your school isn't listed — just type it in.</p>

            <Button type="submit" size="lg" disabled={!schoolName.trim() || submitting} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </form>
    );
}
