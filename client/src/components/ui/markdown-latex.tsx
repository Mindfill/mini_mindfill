import { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// Loaded here (the actual consumer) rather than the app entry point, so it
// ships only with the chat/notes chunks that render LaTeX — not the landing
// page's initial bundle.
import "katex/dist/katex.min.css";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import KeyTermMark from "@/components/notes/KeyTermMark";
import { buildHighlightMatcher, rehypeHighlightKeyTerms, type KeyTerm } from "@/lib/keywordHighlight";

/**
 * Escape dollar signs that are currency, not math. "$100 in it … $25, which"
 * was being read as one inline equation from the first $ to the next,
 * rendering a whole sentence as unbreakable italic math.
 *
 * Currency = `$` + an amount followed by a word or by punctuation — "$100 in",
 * "$125.", "$25, which". Real math keeps its dollars: "$2x$", "$25$",
 * "$2 + 3$" and "$5\,\text{kg}$" don't match. Code spans and fences are left
 * alone, since a `\$` there would show literally.
 */
const CURRENCY_RE = /(^|[^\\$\w])\$(\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?)(?=[.,;:!?)]*(?:\s+[A-Za-z]|\s*$)|[.,;:!?)]+\s)/gm;
const CODE_RE = /(```[\s\S]*?```|`[^`\n]*`)/;

function escapeCurrency(text: string): string {
    return text
        .split(CODE_RE)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(CURRENCY_RE, (_m, pre, amount) => `${pre}\\$${amount}`)))
        .join("");
}

interface MarkdownLatexProps {
    content: string;
    className?: string;
    /** Render inline (span wrapper, no block paragraphs) — for chips, labels, table cells. */
    inline?: boolean;
    /**
     * Feature 05 — when provided (and non-empty), highlights these terms in the
     * rendered text with a hover tooltip / tap bottom-sheet. Omit entirely for
     * every other caller (quiz, flashcards, etc.) — behaviour there is unchanged.
     */
    keyTerms?: KeyTerm[];
}

/**
 * Renders Markdown with inline and block LaTeX math via KaTeX.
 * Also includes premium code syntax highlighting.
 */
export default function MarkdownLatex({ content, className = "", inline = false, keyTerms }: MarkdownLatexProps) {
    const matcher = useMemo(() => buildHighlightMatcher(keyTerms ?? []), [keyTerms]);
    const [activeTerm, setActiveTerm] = useState<{ term: string; definition: string } | null>(null);
    const blockRef = useRef<HTMLDivElement>(null);

    // Tag inline math that's wider than the text column so it scrolls instead
    // of pushing the page sideways (see .katex-wide in index.css). Re-checked
    // on resize because rotating a phone changes which ones fit.
    useEffect(() => {
        const root = blockRef.current;
        if (!root) return;
        let frame = 0;
        const tag = () => {
            const limit = root.clientWidth;
            root.querySelectorAll<HTMLElement>(".katex").forEach((el) => {
                if (el.closest(".katex-display")) return;
                // Natural width without a remove-then-measure reflow: once
                // boxed it's scrollWidth; before that the span is inline
                // (scrollWidth is 0 for inline boxes), so use its rect.
                const natural = el.classList.contains("katex-wide")
                    ? el.scrollWidth
                    : el.getBoundingClientRect().width;
                const wide = natural > limit + 1;
                if (wide !== el.classList.contains("katex-wide")) el.classList.toggle("katex-wide", wide);
            });
        };
        // Deferred a frame: tagging changes the block's height, and doing that
        // inside the observer callback is the "ResizeObserver loop" error.
        const schedule = () => {
            cancelAnimationFrame(frame);
            frame = requestAnimationFrame(tag);
        };
        tag();
        const ro = new ResizeObserver(schedule);
        ro.observe(root);
        // KaTeX's fonts usually arrive after first paint and widen the math
        // without resizing this block — so re-check when they land too.
        const fonts = document.fonts;
        fonts?.ready.then(schedule);
        fonts?.addEventListener?.("loadingdone", schedule);
        return () => {
            cancelAnimationFrame(frame);
            ro.disconnect();
            fonts?.removeEventListener?.("loadingdone", schedule);
        };
    }, [content]);
    // Normalize LaTeX delimiters. Display math (\[ … \]) gets blank lines around
    // it so remark-math treats it as a block and KaTeX renders it on its own
    // line; inline math (\( … \)) stays inline. This also guards against the
    // model emitting the wrong delimiters.
    // Currency first, while every $ still means exactly what the model typed.
    const processedContent = escapeCurrency(content ?? "")
        .replace(/\\\[/g, () => "\n\n$$")
        .replace(/\\\]/g, () => "$$\n\n")
        .replace(/\\\(/g, () => "$")
        .replace(/\\\)/g, () => "$");

    // Inline mode: render into a span with no block paragraphs, so it can live
    // inside chips/labels without breaking flex or truncate layouts. Math still
    // renders via KaTeX; only the paragraph wrapper is flattened.
    if (inline) {
        // A chip label like "1. International Standards" is a title, not a
        // list — unescaped, markdown made it a block <ol> inside the chip.
        const inlineContent = processedContent.replace(/^(\s*\d+)\.(\s)/, "$1\\.$2");
        return (
            <span className={className}>
                <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                    components={{
                        p: ({ children }) => <>{children}</>,
                        strong: ({ children }) => <strong className="font-bold text-inherit">{children}</strong>,
                        em: ({ children }) => <em className="italic text-inherit">{children}</em>,
                    }}
                >
                    {inlineContent}
                </ReactMarkdown>
            </span>
        );
    }

    return (
        <div ref={blockRef} className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex, [rehypeHighlightKeyTerms, matcher]]}
                components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 text-inherit leading-relaxed">{children}</p>,
                    mark: (props: any) =>
                        matcher ? (
                            <KeyTermMark
                                {...props}
                                defMap={matcher.defMap}
                                onTap={(term, definition) => setActiveTerm({ term, definition })}
                            />
                        ) : (
                            <mark {...props} />
                        ),
                    code: ({ node, inline, className: cname, children, ...props }: any) => {
                        const match = /language-(\w+)/.exec(cname || "");
                        return !inline && match ? (
                            <div className="my-4 rounded-xl overflow-hidden border border-border shadow-sm">
                                <div className="flex items-center justify-between px-4 py-1.5 bg-muted/50 border-b border-border">
                                    <span className="text-[10px] text-muted-foreground font-mono uppercase tracking-wider">
                                        {match[1]}
                                    </span>
                                </div>
                                <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{
                                        margin: 0,
                                        padding: "1rem",
                                        background: "transparent",
                                        fontSize: "13px",
                                        lineHeight: "1.6",
                                        // PreTag="div" loses the <pre> default scroll, and the
                                        // wrapper above is overflow-hidden (for the rounded
                                        // corners) — so without this, long lines are silently
                                        // clipped on a 360px screen instead of scrolling.
                                        overflowX: "auto",
                                    }}
                                >
                                    {String(children).replace(/\n$/, "")}
                                </SyntaxHighlighter>
                            </div>
                        ) : (
                            <code className="bg-muted/50 dark:bg-stone-800 px-1.5 py-0.5 rounded text-[0.9em] font-mono text-cyan-700 dark:text-cyan-400" {...props}>
                                {children}
                            </code>
                        );
                    },
                    strong: ({ children }) => <strong className="font-bold text-inherit">{children}</strong>,
                    em: ({ children }) => <em className="italic text-inherit">{children}</em>,
                    ul: ({ children }) => <ul className="list-disc list-inside space-y-1 my-2 text-inherit">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 my-2 text-inherit">{children}</ol>,
                    li: ({ children }) => <li className="text-inherit leading-relaxed">{children}</li>,
                    h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-5 first:mt-0 text-inherit">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-4 first:mt-0 text-inherit">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-base font-semibold mb-2 mt-3 first:mt-0 text-inherit">{children}</h3>,
                    blockquote: ({ children }) => (
                        <blockquote className="border-l-2 border-primary/30 pl-4 my-3 text-muted-foreground italic">
                            {children}
                        </blockquote>
                    ),
                    // A generated comparison table is routinely wider than a
                    // 360px screen. Give it its own horizontal scroll so it
                    // never widens the page, and keep cells from wrapping to
                    // one character per line inside that scroll area.
                    table: ({ children }) => (
                        <div className="my-3 -mx-1 px-1 overflow-x-auto">
                            <table className="w-full text-sm border-collapse">{children}</table>
                        </div>
                    ),
                    th: ({ children }) => (
                        <th className="border border-border px-3 py-1.5 text-left font-semibold align-top min-w-[7rem]">
                            {children}
                        </th>
                    ),
                    td: ({ children }) => (
                        <td className="border border-border px-3 py-1.5 align-top min-w-[7rem]">{children}</td>
                    ),
                }}
            >
                {processedContent}
            </ReactMarkdown>

            {matcher && (
                <Sheet open={!!activeTerm} onOpenChange={(open) => !open && setActiveTerm(null)}>
                    <SheetContent side="bottom" className="max-h-[60vh] overflow-y-auto">
                        <SheetHeader>
                            <SheetTitle className="capitalize">{activeTerm?.term}</SheetTitle>
                            <SheetDescription className="text-foreground text-sm leading-relaxed pt-2">
                                {activeTerm?.definition}
                            </SheetDescription>
                        </SheetHeader>
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
}
