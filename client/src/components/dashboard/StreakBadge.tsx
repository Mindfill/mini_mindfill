import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { Flame } from "lucide-react";

interface StreakBadgeProps {
    currentStreak: number;
    longestStreak: number;
}

export default function StreakBadge({ currentStreak, longestStreak }: StreakBadgeProps) {
    const numberRef = useRef<HTMLSpanElement>(null);
    const iconRef = useRef<HTMLDivElement>(null);
    const prevStreak = useRef(currentStreak);
    const displayValue = useRef({ value: currentStreak });

    useEffect(() => {
        const el = numberRef.current;
        if (!el) return;

        const increased = currentStreak > prevStreak.current;
        const obj = displayValue.current;

        gsap.to(obj, {
            value: currentStreak,
            duration: 0.6,
            ease: "power2.out",
            onUpdate: () => {
                el.textContent = Math.round(obj.value).toString();
            },
        });

        if (increased && iconRef.current) {
            gsap.fromTo(
                iconRef.current,
                { scale: 1, rotate: 0 },
                { scale: 1.35, rotate: -8, duration: 0.25, yoyo: true, repeat: 1, ease: "power1.inOut" }
            );
        }

        prevStreak.current = currentStreak;
    }, [currentStreak]);

    return (
        <div className="flex items-center gap-3 glass-panel rounded-2xl px-5 py-4">
            <div ref={iconRef} className="text-orange-500 flex-shrink-0">
                <Flame className="w-8 h-8 fill-orange-500/20" />
            </div>
            <div>
                <div className="flex items-baseline gap-1.5">
                    <span ref={numberRef} className="text-2xl font-bold tabular-nums">
                        {currentStreak}
                    </span>
                    <span className="text-sm text-muted-foreground">day{currentStreak === 1 ? "" : "s"}</span>
                </div>
                <p className="text-xs text-muted-foreground">Best: {longestStreak} days</p>
            </div>
        </div>
    );
}
