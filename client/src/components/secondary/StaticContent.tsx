import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { VIZ_BOX, VizVideo } from "@/components/chat/ChatContent";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import { BookMarked, ChevronRight } from "lucide-react";
import { parseLessonText, type LessonBlock } from "@/lib/lessonMarkup";
import type { StaticVisual, SubsectionContent, VisualPosition } from "@/lib/secondaryApi";

/** Static visuals reuse the chat's video player; mounted only when near the
 * viewport, with a placeholder until then so the page never waits on video. */
function LazyVisual({ visual, title }: { visual: StaticVisual; title: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || near) return;
        const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setNear(true), { rootMargin: "300px 0px" });
        io.observe(el);
        return () => io.disconnect();
    }, [near]);
    return (
        <figure ref={ref} className="my-8" aria-label={`Animated diagram for ${title}`}>
            {near ? <VizVideo url={visual.url} /> : <div className={`rounded-2xl border border-border bg-muted/40 ${VIZ_BOX} w-full animate-pulse`} />}
        </figure>
    );
}

// Lesson fields in reading order, with the legacy `position` each one's
// visuals attach after when the text carries no [VISUAL] markers.
const FIELDS: { key: "analogy_text" | "intuition_explanation" | "nigerian_real_world_context"; after: VisualPosition }[] = [
    { key: "analogy_text", after: "after_analogy" },
    { key: "intuition_explanation", after: "after_intuition" },
    { key: "nigerian_real_world_context", after: "after_context" },
];

type Placed = LessonBlock | { type: "placed-visual"; visual: StaticVisual };

/**
 * Decides where every approved visual goes:
 *  1. [VISUAL:n] markers take visual n;
 *  2. bare [VISUAL] markers take the next visual (index order) no marker named;
 *  3. anything still unplaced falls back to its authored `position`;
 *  4. anything with no usable position goes at the end — never silently dropped.
 */
function layoutLesson(content: SubsectionContent) {
    const byIndex = new Map(content.visuals.map((v) => [v.index, v]));
    const parsed = FIELDS.map((f) => ({ ...f, blocks: parseLessonText(content[f.key]) }));
    const markers = parsed.flatMap((f) => f.blocks.filter((b): b is Extract<LessonBlock, { type: "visual" }> => b.type === "visual"));

    const used = new Set<number>();
    for (const mk of markers) if (mk.index !== null && byIndex.has(mk.index)) used.add(mk.index);
    const bareQueue = content.visuals.filter((v) => !used.has(v.index));

    const sections: Placed[][] = parsed.map((f) =>
        f.blocks.flatMap((b): Placed[] => {
            if (b.type !== "visual") return [b];
            const visual = b.index !== null ? byIndex.get(b.index) : bareQueue.shift();
            if (!visual) return [];
            used.add(visual.index);
            return [{ type: "placed-visual", visual }];
        }),
    );

    const remaining = content.visuals.filter((v) => !used.has(v.index));
    parsed.forEach((f, i) => {
        for (const v of remaining.filter((r) => r.position === f.after)) {
            sections[i].push({ type: "placed-visual", visual: v });
            used.add(v.index);
        }
    });
    const tail = content.visuals.filter((v) => !used.has(v.index));
    return { sections: sections.filter((s) => s.length > 0), tail };
}

function Block({ block, title }: { block: Placed; title: string }) {
    switch (block.type) {
        case "heading":
            return <h2 className="text-2xl md:text-[1.75rem] font-semibold tracking-tight leading-snug mt-12 first:mt-0 mb-4">{block.text}</h2>;
        case "text":
            return (
                <MarkdownLatex
                    content={block.markdown}
                    className="prose-base md:prose-lg text-foreground/90 [&_p]:mb-5 [&_p:last-child]:mb-0 [&_p]:leading-[1.8]"
                />
            );
        case "spacer":
            return <div aria-hidden className="h-8 md:h-10" />;
        case "placed-visual":
            return <LazyVisual visual={block.visual} title={title} />;
        default:
            return null;
    }
}

function KeyDefinitions({ definitions }: { definitions: SubsectionContent["key_definitions"] }) {
    const isMobile = useIsMobile();
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const current = definitions[Math.min(active, definitions.length - 1)];

    return (
        <Sheet open={open} onOpenChange={setOpen}>
            <div className="flex justify-center pt-4">
                <SheetTrigger asChild>
                    <button className="min-h-[48px] px-5 rounded-full glass-panel border border-primary/25 text-sm font-medium inline-flex items-center gap-2 hover:border-primary/50 transition-colors">
                        <BookMarked className="w-4 h-4 text-primary" />
                        Key definitions
                        <span className="text-xs text-muted-foreground">({definitions.length})</span>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </button>
                </SheetTrigger>
            </div>
            <SheetContent side={isMobile ? "bottom" : "right"} className={isMobile ? "max-h-[80dvh] overflow-y-auto rounded-t-3xl" : "w-full sm:max-w-md overflow-y-auto"}>
                <SheetHeader className="text-left">
                    <SheetTitle className="flex items-center gap-2">
                        <BookMarked className="w-5 h-5 text-primary" /> Key definitions
                    </SheetTitle>
                    <SheetDescription>The words this lesson depends on.</SheetDescription>
                </SheetHeader>

                {definitions.length > 1 && (
                    <div role="tablist" aria-label="Terms" className="flex flex-wrap gap-2 mt-6">
                        {definitions.map((d, i) => (
                            <button
                                key={d.term}
                                role="tab"
                                aria-selected={i === active}
                                onClick={() => setActive(i)}
                                className={`min-h-[40px] px-4 rounded-full text-sm font-medium transition-colors ${
                                    i === active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {d.term}
                            </button>
                        ))}
                    </div>
                )}

                {current && (
                    <div role="tabpanel" className="mt-6 rounded-2xl glass-panel p-5 space-y-2">
                        <p className="text-lg font-semibold text-primary">{current.term}</p>
                        {current.definition ? (
                            <MarkdownLatex content={current.definition} className="prose-base text-foreground/90 [&_p]:leading-relaxed" />
                        ) : (
                            <p className="text-sm text-muted-foreground">No definition written yet.</p>
                        )}
                    </div>
                )}
            </SheetContent>
        </Sheet>
    );
}

/** The authored lesson as one flowing article: headings give it structure,
 * visuals sit between chunks, key definitions open in a panel. The chat
 * prompt isn't shown here — it's the tutor's first message in the chat. */
export default function StaticContent({ content }: { content: SubsectionContent }) {
    const { sections, tail } = useMemo(() => layoutLesson(content), [content]);
    const title = content.subsection_title;

    return (
        <article className="text-[16px] md:text-[17px]">
            {sections.map((blocks, i) => (
                <section key={i} className={i > 0 ? "mt-12" : undefined}>
                    {blocks.map((b, j) => (
                        <Fragment key={j}>
                            <Block block={b} title={title} />
                        </Fragment>
                    ))}
                </section>
            ))}
            {tail.map((v) => (
                <LazyVisual key={`tail-${v.index}`} visual={v} title={title} />
            ))}
            {content.key_definitions.length > 0 && <KeyDefinitions definitions={content.key_definitions} />}
        </article>
    );
}
