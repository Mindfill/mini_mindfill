import TechcessBot, { type BotMood } from "@/components/brand/TechcessBot";

interface WelcomeHeaderProps {
    name: string;
    subtitle?: string;
    /** Show the mascot beside the greeting, in this mood. */
    mascot?: BotMood;
}

export default function WelcomeHeader({ name, subtitle, mascot }: WelcomeHeaderProps) {
    return (
        <div className="flex items-center gap-3 md:gap-4">
            {mascot && <TechcessBot mood={mascot} size={56} className="-ml-1" />}
            <div>
                <h1 className="font-display text-2xl md:text-3xl font-semibold tracking-tight">
                    Welcome back, {name}
                </h1>
                {subtitle && <p className="text-muted-foreground text-sm mt-1.5">{subtitle}</p>}
            </div>
        </div>
    );
}

/** The greeting mascot's mood from how the student's been doing. */
export function greetingMood({ streak, daysAway }: { streak: number; daysAway?: number | null }): BotMood {
    if (daysAway != null && daysAway > 2) return "sleepy";
    if (streak > 0) return "happy";
    return "wave";
}
