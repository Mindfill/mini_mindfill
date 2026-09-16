import { useEffect, useState } from "react";

/**
 * The TECHCESS wordmark drawing itself: the outline strokes in, then a blue
 * gradient fills the letters left to right, holds, and fades for the next
 * loop. Pure SVG + CSS — no JS animation library, so it runs before any lazy
 * chunk has loaded and can never throw mid-frame.
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
                <div className="techcess-loader flex flex-col items-center gap-5">
                    <svg viewBox="0 0 560 90" className="w-[min(78vw,340px)] h-auto overflow-visible" aria-hidden>
                        <defs>
                            <linearGradient id="techcess-loader-fill" x1="0" y1="0" x2="1" y2="0">
                                <stop offset="0%" style={{ stopColor: "hsl(var(--primary))" }} />
                                <stop offset="55%" style={{ stopColor: "hsl(199 95% 60%)" }} />
                                <stop offset="100%" style={{ stopColor: "hsl(var(--primary))" }} />
                            </linearGradient>
                            <clipPath id="techcess-loader-clip">
                                <rect className="techcess-loader-sweep" x="0" y="0" width="560" height="90" />
                            </clipPath>
                        </defs>
                        <text x="50%" y="68" textAnchor="middle" className="techcess-loader-text techcess-loader-outline">
                            TECHCESS
                        </text>
                        <text
                            x="50%"
                            y="68"
                            textAnchor="middle"
                            className="techcess-loader-text techcess-loader-fill"
                            clipPath="url(#techcess-loader-clip)"
                        >
                            TECHCESS
                        </text>
                    </svg>
                    <span className="sr-only">{label}…</span>
                    <div className="techcess-loader-bar h-[3px] w-24 rounded-full bg-primary/15 overflow-hidden">
                        <div className="h-full w-1/3 rounded-full bg-primary/70" />
                    </div>
                </div>
            )}
            <style>{LOADER_CSS}</style>
        </div>
    );
}

const LOADER_CSS = `
.techcess-loader { animation: techcess-loader-in 360ms ease-out both; }
.techcess-loader-text {
  font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
  font-size: 76px;
  font-weight: 700;
  letter-spacing: 0.06em;
}
.techcess-loader-outline {
  fill: transparent;
  stroke: hsl(var(--primary) / 0.55);
  stroke-width: 1.6px;
  stroke-dasharray: 900;
  stroke-dashoffset: 900;
  animation: techcess-loader-draw 2.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
.techcess-loader-fill {
  fill: url(#techcess-loader-fill);
  animation: techcess-loader-fade 2.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
.techcess-loader-sweep {
  transform-box: fill-box;
  transform-origin: left center;
  transform: scaleX(0);
  animation: techcess-loader-sweep 2.8s cubic-bezier(0.65, 0, 0.35, 1) infinite;
}
.techcess-loader-bar > div { animation: techcess-loader-bar 1.4s ease-in-out infinite; }

@keyframes techcess-loader-in { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }
@keyframes techcess-loader-draw {
  0%   { stroke-dashoffset: 900; opacity: 1; }
  40%  { stroke-dashoffset: 0; opacity: 1; }
  85%  { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes techcess-loader-sweep {
  0%, 30% { transform: scaleX(0); }
  65%, 100% { transform: scaleX(1); }
}
/* Opacity inside a clipPath is ignored, so the fade lives on the text itself. */
@keyframes techcess-loader-fade {
  0%, 85% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes techcess-loader-bar { 0% { transform: translateX(-110%); } 100% { transform: translateX(320%); } }

@media (prefers-reduced-motion: reduce) {
  .techcess-loader-outline { animation: none; stroke-dashoffset: 0; }
  .techcess-loader-sweep { animation: none; transform: scaleX(1); }
  .techcess-loader-fill, .techcess-loader-bar > div { animation: techcess-loader-pulse 1.8s ease-in-out infinite; }
  @keyframes techcess-loader-pulse { 50% { opacity: 0.55; } }
}
`;
