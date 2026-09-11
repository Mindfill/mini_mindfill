/**
 * Feature 05 — Keyword highlighting in note chats.
 *
 * Source of truth for the data shape: note_lesson_plans.content (JSON) has a
 * top-level `key_terms: { term, definition }[]` array (confirmed against the
 * actual lesson-plan generation schema in mindfill_mvp_backend/app/routers/notes.py
 * — the feature doc's "key_definitions" column name is stale).
 *
 * Highlighting runs on the parsed markdown/KaTeX hast tree (after rehype-katex),
 * not on raw message text — this app renders assistant messages through
 * react-markdown + remark-math/rehype-katex, so a regex pass over raw text
 * would risk corrupting `$...$` delimiters before they're parsed, and this app
 * has no rehype-raw plugin installed to turn injected HTML strings back into
 * elements. Walking the tree also gives free, robust exclusion of code/KaTeX
 * nodes (by tree position) instead of fragile regex zone-detection.
 */

export interface KeyTerm {
    term: string;
    definition: string;
}

/** Parses/validates the raw `key_terms` value from a lesson plan payload. */
export function extractKeyTerms(raw: unknown): KeyTerm[] {
    if (!Array.isArray(raw)) return [];
    const seen = new Set<string>();
    const out: KeyTerm[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const term = typeof (entry as any).term === "string" ? (entry as any).term.trim() : "";
        const definition = typeof (entry as any).definition === "string" ? (entry as any).definition.trim() : "";
        if (!term || !definition) continue;
        const key = term.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ term, definition });
    }
    return out;
}

function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface HighlightMatcher {
    regex: RegExp;
    /** lowercased term -> definition */
    defMap: Map<string, string>;
}

/** Builds a single combined regex (longest terms first) plus a lookup map. Null if no terms. */
export function buildHighlightMatcher(keyTerms: KeyTerm[]): HighlightMatcher | null {
    if (!keyTerms.length) return null;
    const defMap = new Map(keyTerms.map((k) => [k.term.toLowerCase(), k.definition]));
    const sorted = Array.from(defMap.keys()).sort((a, b) => b.length - a.length);
    const alternation = sorted.map(escapeRegex).join("|");
    // \b works on ASCII word boundaries — sufficient for the vast majority of
    // terms (English words/phrases). Terms with non-word edges (e.g. trailing
    // punctuation) simply won't match verbatim in prose, which is acceptable —
    // per the feature spec, no match just means no highlight, no error.
    const regex = new RegExp(`\\b(?:${alternation})\\b`, "gi");
    return { regex, defMap };
}

const SKIP_TAGS = new Set(["code", "pre", "script", "style"]);

function isSkippableElement(node: any): boolean {
    if (!node || node.type !== "element") return false;
    if (SKIP_TAGS.has(node.tagName)) return true;
    const cls = node.properties?.className;
    if (Array.isArray(cls) && cls.some((c: unknown) => typeof c === "string" && c.includes("katex"))) {
        return true;
    }
    return false;
}

function splitTextNode(value: string, matcher: HighlightMatcher): any[] {
    const { regex } = matcher;
    regex.lastIndex = 0;
    const out: any[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(value)) !== null) {
        if (m.index > last) out.push({ type: "text", value: value.slice(last, m.index) });
        const matched = m[0];
        out.push({
            type: "element",
            tagName: "mark",
            properties: { className: ["key-term"], "data-term": matched.toLowerCase() },
            children: [{ type: "text", value: matched }],
        });
        last = m.index + matched.length;
        if (matched.length === 0) regex.lastIndex += 1; // guard against zero-length matches
    }
    if (last < value.length) out.push({ type: "text", value: value.slice(last) });
    return out.length ? out : [{ type: "text", value }];
}

function walk(node: any, matcher: HighlightMatcher) {
    if (!node || !Array.isArray(node.children) || node.children.length === 0) return;
    const next: any[] = [];
    for (const child of node.children) {
        if (child.type === "element") {
            if (!isSkippableElement(child)) walk(child, matcher);
            next.push(child);
        } else if (child.type === "text" && child.value) {
            next.push(...splitTextNode(child.value, matcher));
        } else {
            next.push(child);
        }
    }
    node.children = next;
}

/**
 * A unified/rehype-shaped plugin: call as a factory, e.g.
 * `rehypePlugins={[rehypeKatex, rehypeHighlightKeyTerms(matcher)]}`.
 * Runs after rehype-katex so KaTeX's own `.katex` subtree already exists and
 * is skipped intact.
 */
export function rehypeHighlightKeyTerms(matcher: HighlightMatcher | null) {
    return (tree: any) => {
        if (!matcher) return;
        walk(tree, matcher);
    };
}
