import { useEffect, useRef } from "react";

/**
 * Lightweight animated CSS-based gradient background.
 * Renders a slow-moving radial amber/cream wash so each section
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

            el.style.background = `
        radial-gradient(ellipse 70% 60% at ${x1}% ${y1}%, rgba(251,191,36,0.13) 0%, transparent 65%),
        radial-gradient(ellipse 60% 55% at ${x2}% ${y2}%, rgba(245,158,11,0.08) 0%, transparent 60%),
        #ffffff
      `;
            rafId = requestAnimationFrame(tick);
        };

        tick();
        return () => cancelAnimationFrame(rafId);
    }, []);

    return <div ref={ref} className={`absolute inset-0 ${className}`} />;
}
