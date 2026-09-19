import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, searchSchools, SchoolResult } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

export default function School({ accessToken, screenNumber, collected, onNext, onBack }: ScreenProps) {
    const [schoolName, setSchoolName] = useState(collected.schoolName || "");
    // Set only while the text still matches the school that was picked. It's
    // what enrols the student into that school's dashboard — typing again
    // clears it, so we never attach someone to a school they edited away from.
    const [schoolId, setSchoolId] = useState<string | null>(null);
    const [suggestions, setSuggestions] = useState<SchoolResult[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeIndex, setActiveIndex] = useState(-1);
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

    useEffect(() => setActiveIndex(-1), [suggestions]);

    const pickSuggestion = (s: SchoolResult) => {
        setSchoolName(s.school_name);
        setSchoolId(s.id);
        setShowSuggestions(false);
    };

    const dropdownOpen = showSuggestions && suggestions.length > 0;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (!dropdownOpen) return;
        if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIndex((i) => (i + 1) % suggestions.length);
        } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
        } else if (e.key === "Enter" && activeIndex >= 0) {
            // Pick the highlighted school instead of submitting the form.
            e.preventDefault();
            pickSuggestion(suggestions[activeIndex]);
        } else if (e.key === "Escape") {
            setShowSuggestions(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const trimmed = schoolName.trim();
        if (!trimmed || submitting) return;
        setSubmitting(true);
        saveSecondaryOnboarding(
            { screen: screenNumber, school_name: trimmed, school_id: schoolId ?? undefined },
            accessToken,
        ).catch((err) => {
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
                        setSchoolId(null);
                        setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setShowSuggestions(false)}
                    onKeyDown={handleKeyDown}
                    placeholder="School name"
                    className="text-lg h-12"
                    disabled={submitting}
                    role="combobox"
                    aria-expanded={dropdownOpen}
                    aria-controls="school-suggestions"
                    aria-autocomplete="list"
                />
                {dropdownOpen && (
                    <div
                        id="school-suggestions"
                        role="listbox"
                        className="absolute z-10 mt-2 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden"
                    >
                        {suggestions.map((s, i) => (
                            <button
                                key={s.id}
                                type="button"
                                role="option"
                                aria-selected={i === activeIndex}
                                // onMouseDown, not onClick: the input's blur fires
                                // between mousedown and click and hid the list
                                // before the click could land. preventDefault
                                // stops the blur entirely, so focus stays put.
                                onMouseDown={(e) => {
                                    e.preventDefault();
                                    pickSuggestion(s);
                                }}
                                onMouseEnter={() => setActiveIndex(i)}
                                className={`w-full text-left px-4 py-2.5 hover-elevate ${i === activeIndex ? "bg-muted" : ""}`}
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
