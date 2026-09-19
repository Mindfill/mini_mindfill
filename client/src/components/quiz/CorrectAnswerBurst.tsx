import { useEffect, useRef } from "react";
import { gsap } from "gsap";

interface CorrectAnswerBurstProps {
    /** Change this to a new non-null value each time a fresh correct answer
     * should trigger the burst (e.g. the question index). Pass null/undefined
     * when the answer was incorrect. */
    triggerKey: string | number | null | undefined;
}

const COLORS = ["#34d399", "#22d3ee", "#a78bfa", "#fbbf24"];
const PARTICLE_COUNT = 10;

/** A small particle burst + icon pop, fired once per correct-answer event.
 * Renders an absolutely-positioned overlay — parent needs `position: relative`. */
export default function CorrectAnswerBurst({ triggerKey }: CorrectAnswerBurstProps) {
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const container = containerRef.current;
        if (triggerKey === null || triggerKey === undefined || !container) return;

        container.innerHTML = "";

        for (let i = 0; i < PARTICLE_COUNT; i++) {
            const particle = document.createElement("div");
            particle.style.position = "absolute";
            particle.style.width = "6px";
            particle.style.height = "6px";
            particle.style.borderRadius = "9999px";
            particle.style.background = COLORS[i % COLORS.length];
            particle.style.left = "50%";
            particle.style.top = "50%";
            container.appendChild(particle);

            const angle = (i / PARTICLE_COUNT) * Math.PI * 2;
            const distance = 36 + Math.random() * 28;

            gsap.fromTo(
                particle,
                { x: 0, y: 0, opacity: 1, scale: 1 },
                {
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance,
                    opacity: 0,
                    scale: 0.3,
                    duration: 0.7,
                    ease: "power2.out",
                    onComplete: () => particle.remove(),
                }
            );
        }
    }, [triggerKey]);

    return <div ref={containerRef} className="pointer-events-none absolute inset-0 overflow-visible z-10" />;
}
