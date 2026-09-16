import { useEffect, useRef } from "react";

/**
 * Lightweight animated CSS-based gradient background.
 * Renders a slow-moving radial light-blue/white wash so each section
 * feels alive without the cost of per-pixel canvas rendering.
 */
export default function AnimatedGradientBg({ className = "" }: { className?: string }) {
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        let t = 0;
        let rafId: number;

        const tick = () => {
            t += 0.003;
            const x1 = 50 + 22 * Math.sin(t * 0.7);
            const y1 = 50 + 18 * Math.cos(t * 0.5);
            const x2 = 50 + 20 * Math.cos(t * 0.6 + 1);
            const y2 = 50 + 22 * Math.sin(t * 0.4 + 2);

            // Colors come from --gradient-via/to (theme-aware: soft blue wash in
            // light mode, deep navy in dark) so this adapts automatically with
            // the rest of the app instead of always rendering a white backdrop.
            el.style.background = `
        radial-gradient(ellipse 70% 60% at ${x1}% ${y1}%, hsl(var(--gradient-via) / 0.35) 0%, transparent 65%),
        radial-gradient(ellipse 60% 55% at ${x2}% ${y2}%, hsl(var(--gradient-to) / 0.22) 0%, transparent 60%),
        hsl(var(--gradient-from))
      `;
            rafId = requestAnimationFrame(tick);
        };

        tick();
        return () => cancelAnimationFrame(rafId);
    }, []);

    // -z-10 keeps it behind page content, and pointer-events-none keeps it
    // from swallowing clicks. Without these it painted (and sat) on top of any
    // content whose own wrapper wasn't positioned — positioned elements draw
    // above in-flow ones. Pages have been adding `relative` to work around
    // that one at a time; the uni lesson chat never did, which hid its whole
    // chat column including the input box.
    return <div ref={ref} className={`absolute inset-0 -z-10 pointer-events-none ${className}`} />;
}
