import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";

/**
 * The "pick up where you left off" card at the top of the student
 * dashboards. Deliberately still: a soft tint marks it as the main action,
 * and only the button responds to hover. (It replaced a BorderBeam that
 * circled the card forever.)
 */
export default function ContinueLearningCard({
    icon,
    eyebrow,
    title,
    meta,
    ctaLabel,
    onClick,
    testId,
}: {
    icon: ReactNode;
    eyebrow: string;
    title: string;
    meta?: ReactNode;
    ctaLabel: string;
    onClick: () => void;
    testId?: string;
}) {
    return (
        <section className="relative overflow-hidden rounded-3xl glass-panel border border-primary/20">
            <div
                aria-hidden
                className="pointer-events-none absolute inset-0 bg-gradient-to-br from-primary/[0.09] via-primary/[0.03] to-transparent"
            />
            <div className="relative p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4 min-w-0">
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        {icon}
                    </div>
                    <div className="min-w-0">
                        <p className="text-xs font-semibold uppercase tracking-wider text-primary">{eyebrow}</p>
                        <h2 className="text-xl md:text-2xl font-semibold mt-1 [overflow-wrap:anywhere]">{title}</h2>
                        {meta && <div className="text-muted-foreground text-sm mt-1.5">{meta}</div>}
                    </div>
                </div>
                <button
                    onClick={onClick}
                    className="group self-start md:self-auto flex-shrink-0 min-h-[48px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center justify-center gap-2 hover:bg-primary/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                    data-testid={testId}
                >
                    {ctaLabel}
                    <ArrowRight className="w-4 h-4 transition-transform duration-200 group-hover:translate-x-0.5 motion-reduce:transition-none" />
                </button>
            </div>
        </section>
    );
}
