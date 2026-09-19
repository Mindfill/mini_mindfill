/**
 * Multiple-choice options embedded in a question's text.
 *
 * Authors write them inline — "Which of these…? (a) first (b) second (c) third"
 * — so without this the student reads a wall of text and types a letter into a
 * free-text box. This pulls the options out so they can be shown as real
 * choices to tap, with capital letters.
 *
 * Deliberately strict: options must start at (a)/(A) and run in sequence, and
 * there must be at least two. Anything else is left as ordinary prose, so a
 * question that merely mentions "(a)" in passing is never mangled into a quiz.
 */

export interface QuizOption {
    /** Always upper case, whatever the author typed. */
    letter: string;
    text: string;
}

export interface ParsedQuestion {
    /** The question itself, with the options removed. */
    stem: string;
    options: QuizOption[];
}

// "(a) ", "a) ", "a. " and their upper-case forms, at a line start or after
// whitespace. The letter is captured; the marker itself is dropped.
const MARKER = /(?:^|[\s])(?:\(([a-hA-H])\)|([a-hA-H])[).]\s)/g;

const LETTERS = "ABCDEFGH";

export function parseQuizOptions(raw: string | null | undefined): ParsedQuestion {
    const text = (raw ?? "").trim();
    if (!text) return { stem: "", options: [] };

    const found: { index: number; end: number; letter: string }[] = [];
    MARKER.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = MARKER.exec(text)) !== null) {
        const letter = (m[1] ?? m[2] ?? "").toUpperCase();
        // The marker may be preceded by the whitespace the pattern consumed.
        const markerStart = m.index + (m[0].length - m[0].trimStart().length);
        found.push({ index: markerStart, end: m.index + m[0].length, letter });
        // Allow the next marker to match immediately after this one.
        MARKER.lastIndex = m.index + m[0].length - 1;
    }

    // Keep only a run that starts at A and steps one letter at a time.
    const run: typeof found = [];
    for (const item of found) {
        if (item.letter === LETTERS[run.length]) run.push(item);
        else if (run.length > 0) break;
    }
    if (run.length < 2) return { stem: text, options: [] };

    const options: QuizOption[] = run.map((item, i) => {
        const end = i + 1 < run.length ? run[i + 1].index : text.length;
        return { letter: item.letter, text: text.slice(item.end, end).trim().replace(/[;,]$/, "") };
    });
    if (options.some((o) => !o.text)) return { stem: text, options: [] };

    return { stem: text.slice(0, run[0].index).trim(), options };
}

/**
 * Drops a leading "(a)"/"A."/"b)" from an option that already carries its own
 * label, so a list rendered with its own letters doesn't read "A  (a) …".
 */
export function stripOptionLabel(option: string): string {
    return (option ?? "").replace(/^\s*(?:\(([a-hA-H])\)|([a-hA-H])[).])\s*/, "").trim();
}

/** What gets submitted for a chosen option: the letter and what it said, so
 * both a letter-based answer key and the grader read it the same way. */
export function formatOptionAnswer(option: QuizOption): string {
    return `${option.letter}) ${option.text}`;
}
