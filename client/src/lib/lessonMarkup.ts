/**
 * Authoring markup in secondary lesson text — mirrors
 * mindfill_mvp_backend/app/core/lesson_markup.py. Keep the two in step.
 *
 *   [HEADING]Title[/HEADING]   section heading (bare line form "[HEADING] Title" also accepted)
 *   [VISUAL] / [VISUAL:2]      where an approved static visual sits; bare markers take the next one
 *   two or more blank lines    a deliberate extra gap between chunks
 *
 * Everything else is ordinary markdown + LaTeX.
 */

export type LessonBlock =
    | { type: "heading"; text: string }
    | { type: "text"; markdown: string }
    | { type: "visual"; index: number | null }
    | { type: "spacer" };

const TOKEN_RE =
    /\[HEADING\]([\s\S]*?)\[\/HEADING\]|^[ \t]*\[HEADING\][ \t]*(\S.*?)[ \t]*$|\[VISUAL(?::\s*(\d+))?\]|\n[ \t]*\n(?:[ \t]*\n)+/gim;

export function parseLessonText(raw: string | null | undefined): LessonBlock[] {
    const text = (raw ?? "").replace(/\r\n?/g, "\n");
    const blocks: LessonBlock[] = [];
    let last = 0;

    const pushText = (chunk: string) => {
        const md = chunk.trim();
        if (md) blocks.push({ type: "text", markdown: md });
    };

    TOKEN_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = TOKEN_RE.exec(text)) !== null) {
        pushText(text.slice(last, m.index));
        last = m.index + m[0].length;
        if (m[1] !== undefined || m[2] !== undefined) {
            const heading = (m[1] ?? m[2] ?? "").replace(/\s+/g, " ").trim();
            if (heading) blocks.push({ type: "heading", text: heading });
        } else if (m[0].toUpperCase().startsWith("[VISUAL")) {
            blocks.push({ type: "visual", index: m[3] ? parseInt(m[3], 10) : null });
        } else {
            blocks.push({ type: "spacer" });
        }
        // A zero-length match can't happen with this pattern, but never loop forever.
        if (m[0].length === 0) TOKEN_RE.lastIndex++;
    }
    pushText(text.slice(last));

    // A gap only means something between two chunks of text/visuals — not at
    // the edges, not doubled, and not right before a heading (which already
    // opens with its own space).
    return blocks.filter((b, i) => {
        if (b.type !== "spacer") return true;
        const prev = blocks[i - 1];
        const next = blocks[i + 1];
        return !!prev && !!next && prev.type !== "spacer" && next.type !== "heading" && prev.type !== "heading";
    });
}

/** Chat-bubble form: headings become a bold line, visual markers disappear. */
export function lessonTextForChat(raw: string | null | undefined): string {
    return parseLessonText(raw)
        .map((b) => (b.type === "heading" ? `**${b.text}**` : b.type === "text" ? b.markdown : ""))
        .filter(Boolean)
        .join("\n\n");
}
