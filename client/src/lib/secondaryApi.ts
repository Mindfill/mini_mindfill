/**
 * Feature 02 — secondary lesson flow API client.
 *
 * Uses the shared authHeaders() from api.ts, so the bearer token and the
 * X-Device-Token header are attached in exactly one place.
 *
 * Error model: every non-2xx becomes a SecondaryApiError carrying the HTTP
 * status and, when the backend sent `detail: {reason}`, that reason
 * ("subscription_required", "locked", "not_ready", "busy", …) so pages can
 * branch on it instead of string-matching messages.
 */
import { BACKEND_URL, authHeaders, extractStreamingContent } from "./api";

export class SecondaryApiError extends Error {
    status: number;
    reason: string | null;
    constructor(status: number, message: string, reason: string | null) {
        super(message);
        this.name = "SecondaryApiError";
        this.status = status;
        this.reason = reason;
    }
}

async function toError(res: Response, fallback: string): Promise<SecondaryApiError> {
    let message = fallback;
    let reason: string | null = null;
    try {
        const body = await res.json();
        const detail = body?.detail;
        if (typeof detail === "string") message = detail;
        else if (detail && typeof detail === "object") {
            if (typeof detail.reason === "string") reason = detail.reason;
            if (typeof detail.message === "string") message = detail.message;
        }
    } catch {
        // not JSON
    }
    return new SecondaryApiError(res.status, message, reason);
}

async function getJson<T>(path: string, accessToken: string, fallback: string): Promise<T> {
    const res = await fetch(`${BACKEND_URL}${path}`, { headers: authHeaders(accessToken) });
    if (!res.ok) throw await toError(res, fallback);
    return res.json();
}

async function postJson<T>(path: string, body: object | null, accessToken: string, fallback: string): Promise<T> {
    const res = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers: authHeaders(accessToken, body !== null),
        body: body !== null ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw await toError(res, fallback);
    return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────

export type SubsectionType =
    | "definition_analogy"
    | "conceptual_illustration"
    | "worked_example"
    | "misconception_address"
    | "translation_to_math"
    | "translation_to_english"
    | "mini_quiz"
    | "end_of_chapter";

export type SubsectionStatus = "locked" | "unlocked" | "in_progress" | "completed";
export type ComprehensionDepth = "surface" | "procedural" | "conceptual" | "transferable";

export const TUTOR_TYPES: SubsectionType[] = [
    "definition_analogy",
    "conceptual_illustration",
    "worked_example",
    "misconception_address",
    "translation_to_math",
    "translation_to_english",
];

export const SUBSECTION_TYPE_LABEL: Record<SubsectionType, string> = {
    definition_analogy: "Concept",
    conceptual_illustration: "Illustration",
    worked_example: "Worked example",
    misconception_address: "Common mistake",
    translation_to_math: "Words → maths",
    translation_to_english: "Maths → words",
    mini_quiz: "Mini quiz",
    end_of_chapter: "Chapter problems",
};

export interface SubjectSummary {
    subject_id: string;
    title: string;
    description: string | null;
    total_subsections: number;
    completed_subsections: number;
    percent_complete: number;
    is_complete: boolean;
}

export interface ChapterSummary {
    chapter_id: string;
    chapter_number: number;
    chapter_title: string;
    learning_objectives: string[];
    is_free: boolean;
    requires_subscription: boolean;
    coming_soon: boolean;
    locked: boolean;
    total_subsections: number;
    completed_subsections: number;
    percent_complete: number;
    is_complete: boolean;
}

export interface TocSubsection {
    subsection_id: string;
    subsection_title: string;
    subsection_type: SubsectionType;
    status: SubsectionStatus;
    available: boolean;
}

export interface TocSection {
    section_id: string;
    section_number: number;
    section_label: string;
    is_complete: boolean;
    completed_subsections: number;
    subsections: TocSubsection[];
}

export interface NextDestination {
    subsection_id: string;
    subsection_title: string;
    subsection_type: SubsectionType;
    chapter_id: string;
    chapter_title: string;
    is_new_chapter: boolean;
    is_free: boolean;
    requires_subscription?: boolean;
}

export type VisualPosition = "after_analogy" | "after_intuition" | "after_context" | "after_definitions";

export interface StaticVisual {
    index: number;
    /** null when a [VISUAL] marker in the lesson text places it instead. */
    position: VisualPosition | null;
    url: string;
}

export interface SubsectionContent {
    subsection_id: string;
    subsection_title: string;
    subsection_type: SubsectionType;
    analogy_text: string | null;
    intuition_explanation: string | null;
    nigerian_real_world_context: string | null;
    key_definitions: { term: string; definition: string }[];
    chat_prompt_text: string | null;
    visuals: StaticVisual[];
}

export interface SubsectionResponse {
    subsection: SubsectionContent;
    breadcrumb: {
        subject_id: string;
        subject_title: string;
        chapter_id: string;
        chapter_title: string;
        section_label: string;
    };
    progress: {
        section_number: number;
        section_count: number;
        subsection_number: number;
        subsection_count: number;
    };
    state: { status: SubsectionStatus; comprehension_depth: ComprehensionDepth | null };
    active_session: { id: string } | null;
    has_previous_sessions: boolean;
    next: NextDestination | null;
}

export interface SessionState {
    session_id: string;
    session_type: "first_attempt" | "review";
    status: "active" | "completed" | "abandoned";
    exchange_count: number;
    comprehension_depth: ComprehensionDepth | null;
    unlock_ready: boolean;
    min_exchange_count: number;
    exchange_ceiling: number;
}

export interface SecondaryMessage {
    role: "user" | "assistant";
    content: string;
    session_id?: string;
    created_at?: string;
}

export interface Progression {
    next: NextDestination | null;
    chapter_completed: boolean;
    subject_completed: boolean;
    chapter_title: string;
}

// ── Navigation ─────────────────────────────────────────────────────────────

export const fetchSubjects = (t: string) =>
    getJson<{ class_level: string | null; subjects: SubjectSummary[] }>("/secondary/subjects", t, "Couldn't load subjects");

export const fetchChapters = (subjectId: string, t: string) =>
    getJson<{ subject: { subject_id: string; title: string }; has_subscription: boolean; chapters: ChapterSummary[] }>(
        `/secondary/chapters/${encodeURIComponent(subjectId)}`, t, "Couldn't load chapters",
    );

export const fetchChapterToc = (chapterId: string, t: string) =>
    getJson<{ subject: { subject_id: string; title: string }; chapter: ChapterSummary; sections: TocSection[] }>(
        `/secondary/sections/${encodeURIComponent(chapterId)}`, t, "Couldn't load chapter",
    );

export const fetchSubsection = (subsectionId: string, t: string) =>
    getJson<SubsectionResponse>(`/secondary/subsections/${encodeURIComponent(subsectionId)}`, t, "Couldn't load this lesson");

export const fetchStartHere = (t: string) =>
    getJson<{ subsection_id: string | null; chapter_id?: string }>("/secondary/start-here", t, "Couldn't find your first lesson");

// ── Tutor sessions ─────────────────────────────────────────────────────────

export const startSession = (subsectionId: string, t: string) =>
    postJson<{ resumed: boolean; session: SessionState; messages: SecondaryMessage[] }>(
        "/secondary/sessions/start", { subsection_id: subsectionId }, t, "Couldn't start your tutor",
    );

export const completeSession = (sessionId: string, t: string) =>
    postJson<Progression & { already_completed: boolean; session: SessionState }>(
        "/secondary/sessions/complete", { session_id: sessionId }, t, "Couldn't finish this lesson",
    );

export const fetchSessionState = (sessionId: string, t: string) =>
    getJson<SessionState>(`/secondary/sessions/${encodeURIComponent(sessionId)}`, t, "Couldn't check your progress");

export const fetchSubsectionConversation =(subsectionId: string, t: string) =>
    getJson<SecondaryMessage[]>(`/secondary/subsections/${encodeURIComponent(subsectionId)}/conversation`, t, "Couldn't load the conversation");

// ── Named-event SSE ────────────────────────────────────────────────────────

export interface NamedStreamHandlers {
    /** Progressive `content` extracted from the streaming JSON. */
    onContent?: (content: string) => void;
    onEvent?: (event: string, data: string) => void;
    /** The reply is saved and final. The stream stays open a little longer
     * for the assessment, but the student can type again from here. */
    onFinal?: (content: string, sessionId: string) => void;
}

/**
 * Reads `event: <name>\ndata: …\ndata: …\n\n` frames. Multi-line data is
 * rejoined with "\n" (the backend splits deltas on newlines so a newline can
 * never break framing). Resolves when the stream closes; `error` events
 * reject with their message.
 */
async function readNamedSSE(res: Response, handlers: NamedStreamHandlers): Promise<{ text: string; events: Record<string, string> }> {
    if (!res.body) throw new Error("No response body to stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let text = "";
    const events: Record<string, string> = {};

    const handleFrame = (frame: string) => {
        let event = "message";
        const data: string[] = [];
        for (const line of frame.split("\n")) {
            if (line.startsWith("event:")) event = line.slice(6).trim();
            else if (line.startsWith("data:")) data.push(line.slice(5).startsWith(" ") ? line.slice(6) : line.slice(5));
        }
        const payload = data.join("\n");
        if (event === "error") throw new SecondaryApiError(200, payload || "Your tutor couldn't respond just now.", "stream_error");
        if (event === "delta") {
            text += payload;
            const c = extractStreamingContent(text);
            if (c !== null) handlers.onContent?.(c);
            return;
        }
        events[event] = payload;
        handlers.onEvent?.(event, payload);
    };

    while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            if (frame.trim()) handleFrame(frame);
        }
    }
    if (buffer.trim()) handleFrame(buffer);
    return { text, events };
}

export interface ChatTurnResult {
    /** Final, server-numbered content (from the `final` event). */
    content: string;
    session_id: string;
    session: (SessionState & { assessment_pending: boolean }) | null;
}

export async function sendTutorMessage(
    sessionId: string,
    message: string,
    accessToken: string,
    handlers: NamedStreamHandlers = {},
): Promise<ChatTurnResult> {
    const res = await fetch(`${BACKEND_URL}/secondary/sessions/chat`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ session_id: sessionId, message }),
    });
    if (!res.ok) throw await toError(res, "Couldn't send your message");

    const { text, events } = await readNamedSSE(res, {
        ...handlers,
        onEvent: (event, data) => {
            handlers.onEvent?.(event, data);
            if (event !== "final" || !handlers.onFinal) return;
            try {
                const f = JSON.parse(data);
                if (typeof f.content === "string") handlers.onFinal(f.content, typeof f.session_id === "string" ? f.session_id : sessionId);
            } catch {
                // malformed final — the resolved result falls back to the streamed text
            }
        },
    });
    let content = extractStreamingContent(text) ?? "";
    let sid = sessionId;
    if (events.final) {
        try {
            const f = JSON.parse(events.final);
            if (typeof f.content === "string") content = f.content;
            if (typeof f.session_id === "string") sid = f.session_id;
        } catch {
            // keep the streamed content
        }
    }
    let session = null;
    if (events.assessment) {
        try {
            session = JSON.parse(events.assessment);
        } catch {
            session = null;
        }
    }
    // `done` carries an empty payload, so check presence, not truthiness.
    if (!("final" in events) && !("done" in events)) {
        throw new SecondaryApiError(200, "The connection dropped before your tutor finished. Please try again.", "stream_incomplete");
    }
    return { content, session_id: sid, session };
}

// ── Mini quiz ──────────────────────────────────────────────────────────────

export type QuizResult = "pass" | "partial" | "fail";

export interface QuizQuestionState {
    problem_id: string;
    question_text: string;
    question_type: "conceptual" | "procedural" | "real_world";
    difficulty: string;
    marks: number | null;
    attempts: number;
    passed: boolean;
    seen_solution: boolean;
    last_result: QuizResult | null;
    last_feedback: string | null;
    answer?: string;
    working?: string;
}

export const fetchQuiz = (subsectionId: string, t: string) =>
    getJson<{ subsection_id: string; questions: QuizQuestionState[]; is_complete: boolean; next: NextDestination | null }>(
        `/secondary/quiz/${encodeURIComponent(subsectionId)}`, t, "Couldn't load the quiz",
    );

export const submitQuizAnswer = (problemId: string, answer: string, t: string) =>
    postJson<{
        result: QuizResult;
        feedback: string;
        attempt_number: number;
        quiz_complete: boolean;
        completion: Progression | null;
        answer?: string;
        working?: string;
    }>("/secondary/quiz/submit", { problem_id: problemId, answer }, t, "Couldn't submit your answer");

export const revealQuizSolution = (problemId: string, t: string) =>
    postJson<{ answer: string; working: string; quiz_complete: boolean; completion: Progression | null }>(
        "/secondary/quiz/reveal", { problem_id: problemId }, t, "Couldn't show the solution",
    );

/** Completes a mini quiz / end-of-chapter subsection (incl. ones with no questions yet). */
export const completeNonTutorSubsection = (subsectionId: string, t: string) =>
    postJson<Progression>(`/secondary/subsections/${encodeURIComponent(subsectionId)}/complete`, null, t, "Couldn't continue");

// ── End-of-chapter problems ────────────────────────────────────────────────

export interface ChapterProblem {
    problem_id: string;
    question_text: string;
    question_type: string;
    difficulty: string;
    marks: number | null;
    tutor_available: boolean;
    submitted: boolean;
    understood: boolean;
    latest_working: string | null;
    answer?: string;
    working?: string;
}

export const fetchChapterProblems = (chapterId: string, t: string) =>
    getJson<{ chapter_id: string; chapter_title: string; subsection_id: string; is_complete: boolean; problems: ChapterProblem[] }>(
        `/secondary/problems/${encodeURIComponent(chapterId)}`, t, "Couldn't load the chapter problems",
    );

export const submitProblemWorking = (problemId: string, working: string, t: string) =>
    postJson<{ answer: string; working: string; chapter_complete: boolean; completion: Progression | null }>(
        "/secondary/problems/submit", { problem_id: problemId, working }, t, "Couldn't submit your working",
    );

export const markProblemUnderstood = (problemId: string, t: string) =>
    postJson<{ understood: boolean }>("/secondary/problems/understood", { problem_id: problemId }, t, "Couldn't save that");

export const startProblemChat = (problemId: string, t: string) =>
    postJson<{ messages: SecondaryMessage[] }>("/secondary/problems/chat/start", { problem_id: problemId }, t, "Couldn't start the tutor");

export async function sendProblemTutorMessage(
    problemId: string,
    message: string,
    accessToken: string,
    handlers: NamedStreamHandlers = {},
): Promise<string> {
    const res = await fetch(`${BACKEND_URL}/secondary/problems/chat`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ problem_id: problemId, message }),
    });
    if (!res.ok) throw await toError(res, "Couldn't send your message");
    const { text, events } = await readNamedSSE(res, handlers);
    if (!("done" in events)) {
        throw new SecondaryApiError(200, "The connection dropped before your tutor finished. Please try again.", "stream_incomplete");
    }
    return extractStreamingContent(text) ?? "";
}
