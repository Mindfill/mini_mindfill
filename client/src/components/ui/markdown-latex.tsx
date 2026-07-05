import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownLatexProps {
    content: string;
    className?: string;
    /** Render inline (span wrapper, no block paragraphs) — for chips, labels, table cells. */
    inline?: boolean;
}

/**
 * Renders Markdown with inline and block LaTeX math via KaTeX.
 * Also includes premium code syntax highlighting.
 */
export default function MarkdownLatex({ content, className = "", inline = false }: MarkdownLatexProps) {
    const processedContent = (content ?? "")
        .replace(/\\\[/g, () => "$$")
        .replace(/\\\]/g, () => "$$")
        .replace(/\\\(/g, () => "$")
        .replace(/\\\)/g, () => "$");

    // Inline mode: render into a span with no block paragraphs, so it can live
    // inside chips/labels without breaking flex or truncate layouts. Math still
    // renders via KaTeX; only the paragraph wrapper is flattened.
    if (inline) {
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
                    {processedContent}
                </ReactMarkdown>
            </span>
        );
    }

    return (
        <div className={`prose prose-sm dark:prose-invert max-w-none ${className}`}>
            <ReactMarkdown
                remarkPlugins={[remarkMath]}
                rehypePlugins={[rehypeKatex]}
                components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 text-inherit leading-relaxed">{children}</p>,
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
                }}
            >
                {processedContent}
            </ReactMarkdown>
        </div>
    );
}
