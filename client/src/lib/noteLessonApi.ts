/**
 * Uni section lessons (docs/TECHCESS_NOTES_LESSON_UI_SPEC.md).
 * Backend: mindfill_mvp_backend/app/routers/note_lessons.py.
 *
 * A note is taught one section at a time; each section has its own tutor
 * session, and sections open in any order. Section ids are
 * note_sections.section_index.
 */

import { BACKEND_URL, OutOfCreditsError, authHeaders, readAccumulatedSSE } from "./api";

export type Signal = "green" | "orange" | "red" | null;
export type Phase = 1 | 2 | 3;
export type ChipSet = "comprehension" | "confirm" | "choice";
/** Nothing is locked — any section can be opened in any order. */
export type NodeState = "done" | "available";

export const CHIP_SETS: Record<ChipSet, string[]> = {
    comprehension: ["Yes, keep going", "Slow down"],
    confirm: ["Got it", "Not quite"],
    choice: ["Show me", "I'll re-read first"],
};

export const PHASE_LABELS: Record<Phase, string> = {
    1: "Intuition",
    2: "Going deeper",
    3: "Test yourself",
};

export interface BoardSection {
    section_index: number;
    title: string;
    state: NodeState;
    started: boolean;
}

export interface NoteBoard {
    note_id: string;
    title: string;
    file_url: string | null;
    current_section: number | null;
    sections: BoardSection[];
}

export interface LessonMessage {
    role: "user" | "assistant";
    content: string;
    signal?: Signal;
    phase?: Phase | null;
    requires_chips?: boolean;
    chip_set?: ChipSet | null;
}

export interface SectionState {
    section_index: number;
    title: string;
    state: NodeState;
    next_section: number | null;
    key_terms: unknown;
    session_id: string | null;
    is_review: boolean;
    phase: Phase;
    messages: LessonMessage[];
    read_only: boolean;
    needs_opening: boolean;
}

export interface OpenResult {
    session_id: string;
    messages: LessonMessage[];
    phase: Phase;
    is_review: boolean;
    /** Present when the open just built the section's plan. */
    key_terms?: unknown;
}

export interface SectionReply {
    content: string;
    session_id: string;
    signal: Signal;
    phase: Phase;
    requires_chips: boolean;
    chip_set: ChipSet | null;
    section_complete: boolean;
    next_section: number | null;
    note_complete: boolean;
}

export interface NoteSectionText {
    section_index: number;
    title: string;
    content: string;
}

async function failFrom(res: Response, what: string): Promise<never> {
    if (res.status === 402) throw new OutOfCreditsError();
    const text = (await res.text()) || res.statusText;
    throw new Error(`${what}: ${res.status} — ${text}`);
}

async function getJson<T>(path: string, accessToken: string, what: string): Promise<T> {
    const res = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders(accessToken) });
    if (!res.ok) return failFrom(res, what);
    return res.json();
}

export function fetchNoteBoard(noteId: string, accessToken: string) {
    return getJson<NoteBoard>(`/notes/${noteId}/board`, accessToken, "Failed to load board");
}

export function fetchNoteText(noteId: string, accessToken: string) {
    return getJson<NoteSectionText[]>(`/notes/${noteId}/content`, accessToken, "Failed to load note");
}

export function fetchSectionState(noteId: string, sectionIndex: number, accessToken: string) {
    return getJson<SectionState>(
        `/notes/${noteId}/sections/${sectionIndex}`,
        accessToken,
        "Failed to load lesson",
    );
}

/** Spec §5.3 — the tutor speaks first. `review` starts a fresh session on a
 *  completed section. The first open of a section also builds that section's
 *  lesson plan (same call, ~3–5s), so there's no separate plan step. */
export async function openSection(
    noteId: string,
    sectionIndex: number,
    accessToken: string,
    review = false,
): Promise<OpenResult> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/sections/${sectionIndex}/open`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ review }),
    });
    if (!res.ok) return failFrom(res, "Failed to start lesson");
    return res.json();
}

const SIGNAL_RE = /"signal"\s*:\s*(null|"(green|orange|red)")/;

export async function sendSectionMessage(
    noteId: string,
    sectionIndex: number,
    content: string,
    accessToken: string,
    handlers: {
        /** Fires as soon as the signal streams — it's the first field. */
        onSignal?: (signal: Signal) => void;
        onContent?: (content: string) => void;
    } = {},
): Promise<SectionReply> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/sections/${sectionIndex}/chat`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ content }),
    });
    if (!res.ok || !res.body) return failFrom(res, "Failed to send message");

    let signalSent = false;
    const { text, final } = await readAccumulatedSSE(res, {
        onContent: handlers.onContent,
        onRaw: (acc) => {
            if (signalSent) return;
            const m = acc.match(SIGNAL_RE);
            if (m) {
                signalSent = true;
                handlers.onSignal?.((m[2] as Signal) ?? null);
            }
        },
    });

    // [FINAL] is server-authoritative (VIZ numbers, completion guard); the
    // streamed JSON is only the fallback.
    if (final) return final as unknown as SectionReply;
    try {
        return JSON.parse(text) as SectionReply;
    } catch {
        throw new Error("Streamed response was malformed.");
    }
}
