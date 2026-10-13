export type BotMood = "idle" | "thinking" | "happy" | "wave" | "sleepy";

/**
 * The TECHCESS mascot: a tiny round robot with a screen face. Inline SVG so it
 * is crisp at every size, costs no network request, and can render before any
 * lazy chunk has loaded (it's used by the app-wide loader).
 *
 * Colours come from the theme tokens, so it follows light/dark mode. All motion
 * is CSS (the `.tbot*` rules in index.css) and is switched off under
 * prefers-reduced-motion.
 *
 * - `headOnly` drops the body and arm — the right crop for small avatars.
 * - `animated={false}` keeps the face (mood) but stops the motion, for places
 *   that repeat it many times, like every message in a chat history.
 */
export default function TechcessBot({
    mood = "idle",
    size = 64,
    headOnly = false,
    animated = true,
    className = "",
    title,
}: {
    mood?: BotMood;
    size?: number;
    headOnly?: boolean;
    animated?: boolean;
    className?: string;
    /** Accessible name. Omit for a decorative bot (the default). */
    title?: string;
}) {
    const viewBox = headOnly ? "6 2 52 46" : "0 0 64 64";

    return (
        <svg
            viewBox={viewBox}
            width={size}
            height={size}
            className={`tbot tbot-${mood} ${animated ? "tbot-animated" : ""} overflow-visible flex-shrink-0 ${className}`}
            role={title ? "img" : undefined}
            aria-label={title}
            aria-hidden={title ? undefined : true}
            focusable="false"
        >
            <g className="tbot-float">
                {/* Antenna */}
                <line x1="32" y1="14" x2="32" y2="7.5" stroke="hsl(var(--primary))" strokeWidth="2.2" strokeLinecap="round" />
                <circle className="tbot-antenna" cx="32" cy="6" r="3.2" fill="hsl(190 95% 62%)" />

                {/* Body + arms (full bot only) */}
                {!headOnly && (
                    <>
                        <rect x="21" y="44" width="22" height="14" rx="7" fill="hsl(var(--primary))" />
                        <rect x="21" y="44" width="22" height="14" rx="7" fill="black" opacity="0.12" />
                        <circle cx="32" cy="51" r="2.4" fill="hsl(190 95% 70%)" className="tbot-heart" />
                        <rect x="14.5" y="46" width="6" height="9" rx="3" fill="hsl(var(--primary))" />
                        <g className="tbot-arm">
                            <rect x="43.5" y="46" width="6" height="9" rx="3" fill="hsl(var(--primary))" />
                        </g>
                    </>
                )}

                {/* Ears */}
                <rect x="8.5" y="24" width="5" height="12" rx="2.5" fill="hsl(var(--primary))" />
                <rect x="50.5" y="24" width="5" height="12" rx="2.5" fill="hsl(var(--primary))" />

                {/* Head */}
                <rect x="12" y="13" width="40" height="33" rx="13" fill="hsl(var(--primary))" />
                <ellipse cx="22" cy="18.5" rx="6" ry="2.6" fill="white" opacity="0.28" />

                {/* Screen face */}
                <rect x="16.5" y="19.5" width="31" height="21" rx="8.5" fill="hsl(215 50% 11%)" />

                <Face mood={mood} />

                {mood === "sleepy" && (
                    <g className="tbot-zzz" fill="hsl(var(--primary))" fontFamily="var(--font-display), sans-serif" fontWeight="700">
                        <text x="51" y="12" fontSize="7">z</text>
                        <text x="56" y="6" fontSize="5">z</text>
                    </g>
                )}
            </g>
        </svg>
    );
}

const EYE = "hsl(190 95% 70%)";

function Face({ mood }: { mood: BotMood }) {
    if (mood === "happy" || mood === "wave") {
        return (
            <g fill="none" stroke={EYE} strokeWidth="2.4" strokeLinecap="round">
                <path d="M23 31.5 q3 -4 6 0" />
                <path d="M35 31.5 q3 -4 6 0" />
                <path d="M29 35.5 q3 2.4 6 0" strokeWidth="2" />
                <Cheeks />
            </g>
        );
    }
    if (mood === "sleepy") {
        return (
            <g fill="none" stroke={EYE} strokeWidth="2.2" strokeLinecap="round">
                <path d="M23 30.5 q3 2.2 6 0" />
                <path d="M35 30.5 q3 2.2 6 0" />
                <path d="M30.5 35.5 h3" strokeWidth="1.8" />
            </g>
        );
    }
    // idle + thinking: round eyes that blink (and glance around when thinking)
    return (
        <g>
            <g className="tbot-eyes">
                <rect x="23.5" y="26" width="5" height="7" rx="2.5" fill={EYE} />
                <rect x="35.5" y="26" width="5" height="7" rx="2.5" fill={EYE} />
            </g>
            {mood === "idle" && (
                <path d="M29.5 36 q2.5 1.8 5 0" fill="none" stroke={EYE} strokeWidth="1.8" strokeLinecap="round" />
            )}
            {mood === "thinking" && <circle cx="32" cy="36.5" r="1.3" fill={EYE} />}
            <Cheeks />
        </g>
    );
}

function Cheeks() {
    return (
        <g stroke="none" fill="hsl(345 90% 72%)" opacity="0.55">
            <ellipse cx="20.5" cy="35.5" rx="2" ry="1.3" />
            <ellipse cx="43.5" cy="35.5" rx="2" ry="1.3" />
        </g>
    );
}
