import { useState } from "react";
import { Loader2, GraduationCap, School, Users } from "lucide-react";
import { setUserType, UserType } from "@/lib/api";

interface WhoAreYouProps {
    accessToken: string;
    currentType: UserType | null;
    onSelect: (type: UserType) => void;
}

const OPTIONS: { value: UserType; label: string; description: string; icon: typeof School }[] = [
    { value: "secondary", label: "Secondary student", description: "SS1 – SS3", icon: School },
    { value: "university", label: "University student", description: "Undergraduate", icon: GraduationCap },
    { value: "parent", label: "Parent or guardian", description: "Following a student's progress", icon: Users },
];

export default function WhoAreYou({ accessToken, currentType, onSelect }: WhoAreYouProps) {
    const [submitting, setSubmitting] = useState<UserType | null>(null);

    const handlePick = async (type: UserType) => {
        if (submitting) return;
        setSubmitting(type);
        try {
            await setUserType(type, accessToken);
            onSelect(type);
        } catch (err) {
            console.error("Failed to set user type:", err);
        } finally {
            setSubmitting(null);
        }
    };

    return (
        <div className="text-center space-y-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                Who's this for?
            </h1>

            <div className="grid gap-3">
                {OPTIONS.map(({ value, label, description, icon: Icon }) => (
                    <button
                        key={value}
                        onClick={() => handlePick(value)}
                        disabled={submitting !== null}
                        className={`flex items-center gap-4 text-left p-5 rounded-2xl border transition-colors hover-elevate active-elevate-2 ${
                            currentType === value ? "border-amber bg-amber/5" : "border-border bg-card"
                        } disabled:opacity-60`}
                    >
                        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            {submitting === value ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <Icon className="w-5 h-5" />
                            )}
                        </div>
                        <div>
                            <p className="font-semibold">{label}</p>
                            <p className="text-sm text-muted-foreground">{description}</p>
                        </div>
                    </button>
                ))}
            </div>
        </div>
    );
}
