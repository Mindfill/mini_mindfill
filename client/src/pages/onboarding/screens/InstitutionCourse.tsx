import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { saveUniversityOnboarding } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

export default function InstitutionCourse({ accessToken, screenNumber, collected, onNext, onBack }: ScreenProps) {
    const [institution, setInstitution] = useState(collected.institutionName || "");
    const [course, setCourse] = useState(collected.courseOfStudy || "");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const inst = institution.trim();
        const crs = course.trim();
        if (!inst || !crs || submitting) return;
        setSubmitting(true);
        saveUniversityOnboarding(
            { screen: screenNumber, institution_name: inst, course_of_study: crs },
            accessToken
        ).catch((err) => {
            console.error("Failed to save institution/course:", err);
        });
        setTimeout(() => onNext({ institutionName: inst, courseOfStudy: crs }), ADVANCE_DELAY_MS);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Where are you studying and what are you reading?
            </h1>

            <div className="space-y-4 text-left">
                <div className="space-y-1.5">
                    <Label htmlFor="institution">University / Institution</Label>
                    <Input
                        id="institution"
                        autoFocus
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="e.g., University of Lagos"
                        className="h-12"
                        disabled={submitting}
                    />
                </div>
                <div className="space-y-1.5">
                    <Label htmlFor="course">Course of study</Label>
                    <Input
                        id="course"
                        value={course}
                        onChange={(e) => setCourse(e.target.value)}
                        placeholder="e.g., Computer Engineering"
                        className="h-12"
                        disabled={submitting}
                    />
                </div>
            </div>

            <Button
                type="submit"
                size="lg"
                disabled={!institution.trim() || !course.trim() || submitting}
                className="w-full gap-2"
            >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </form>
    );
}
