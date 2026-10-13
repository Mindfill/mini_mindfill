import { useEffect, useState } from "react";
import TechcessBot from "@/components/brand/TechcessBot";

/**
 * The mascot loader: the TECHCESS bot bobbing and glancing around, with a
 * small wordmark and progress shimmer under it. Pure SVG + CSS — no JS
 * animation library — so it runs before any lazy chunk has loaded and can
 * never throw mid-frame.
 *
 * This is for first loads (opening the app, signing in, opening a lesson).
 * Moving between sidebar tabs uses the page skeletons in
 * components/skeletons instead, so the sidebar never disappears.
 *
 * `delayMs` keeps fast loads from flashing a loader for a few frames: nothing
 * renders until the wait has actually lasted that long.
 */
export default function TechcessLoader({
    fullScreen = false,
    label = "Loading",
    delayMs = 120,
    className = "",
}: {
    fullScreen?: boolean;
    label?: string;
    delayMs?: number;
    className?: string;
}) {
    const [visible, setVisible] = useState(delayMs === 0);

    useEffect(() => {
        if (delayMs === 0) return;
        const t = setTimeout(() => setVisible(true), delayMs);
        return () => clearTimeout(t);
    }, [delayMs]);

    return (
        <div
            role="status"
            aria-live="polite"
            aria-label={label}
            className={`${fullScreen ? "h-[100dvh] w-full bg-background" : "w-full min-h-[60vh]"} flex items-center justify-center ${className}`}
        >
            {visible && (
                <div className="techcess-loader flex flex-col items-center">
                    <TechcessBot mood="thinking" size={fullScreen ? 96 : 80} />
                    <div className="techcess-loader-shadow mt-1 h-2 w-12 rounded-[50%] bg-foreground/10" aria-hidden />
                    <p className="mt-4 font-display text-sm font-bold tracking-[0.28em] text-foreground/80" aria-hidden>
                        TECHCESS
                    </p>
                    <span className="sr-only">{label}…</span>
                    <div className="techcess-loader-bar mt-3 h-[3px] w-20 rounded-full bg-primary/15 overflow-hidden" aria-hidden>
                        <div className="h-full w-1/3 rounded-full bg-primary/70" />
                    </div>
                </div>
            )}
            <style>{LOADER_CSS}</style>
        </div>
    );
}

// The shadow breathes in time with the bot's bob (tbot-bob, 2.6s in index.css).
const LOADER_CSS = `
.techcess-loader { animation: techcess-loader-in 360ms ease-out both; }
.techcess-loader-shadow { animation: techcess-loader-shadow 2.6s ease-in-out infinite; }
.techcess-loader-bar > div { animation: techcess-loader-bar 1.4s ease-in-out infinite; }

@keyframes techcess-loader-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes techcess-loader-shadow { 0%, 100% { transform: scaleX(1); opacity: 1; } 50% { transform: scaleX(0.8); opacity: 0.6; } }
@keyframes techcess-loader-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }

@media (prefers-reduced-motion: reduce) {
  .techcess-loader-shadow { animation: none; }
  .techcess-loader-bar > div { animation: techcess-loader-pulse 1.8s ease-in-out infinite; }
  @keyframes techcess-loader-pulse { 50% { opacity: 0.55; } }
}
`;
