/**
 * Backend API client for TECHCESS lesson chat.
 * All requests attach the Supabase JWT as a Bearer token.
 */

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://mindfill-api.onrender.com").trim().replace(/[`'"]/g, "");

export interface ChatMessage {
    role: "user" | "assistant";
    content: string;
    lesson_id?: string;
    session_id?: string;
}

/**
 * Fetch chat history for a specific lesson.
 * GET /lessons/{lessonSlug}/history
 */
export async function fetchLessonHistory(
    lessonSlug: string,
    accessToken: string
): Promise<ChatMessage[]> {
    console.log(`[API] Fetching history for: ${lessonSlug} at ${BACKEND_URL}`);
    const res = await fetch(`${BACKEND_URL}/lessons/${lessonSlug}/history`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        console.error(`[API] History fetch failed: ${res.status}`, text);
        throw new Error(`Failed to fetch history: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Submit a message to a lesson chat.
 * POST /lessons/{lessonSlug}/submit
 */
/**
 * Read a Server-Sent Events stream where each `data: <chunk>` is a slice of the
 * payload, terminated by `data: [DONE]` (or `data: [ERROR] …`). Returns the
 * accumulated text; the caller decides how to interpret it.
 */
export interface StreamHandlers {
    /** Live section-progress percentage (0–100). */
    onProgress?: (pct: number) => void;
    /** The `content` field value extracted progressively as the JSON streams. */
    onContent?: (content: string) => void;
}

/**
 * Extract the (possibly still-streaming) `content` string value from a partial
 * JSON string. Content is the first/longest field, so it's readable well before
 * the whole object closes. Handles JSON escapes and an unterminated tail.
 */
export function extractStreamingContent(acc: string): string | null {
    const m = acc.match(/"content"\s*:\s*"/);
    if (!m || m.index === undefined) return null;
    const start = m.index + m[0].length;
    let out = "";
    for (let i = start; i < acc.length; i++) {
        const ch = acc[i];
        if (ch === "\\") {
            const next = acc[i + 1];
            if (next === undefined) break; // incomplete escape at the streaming edge
            switch (next) {
                case "n": out += "\n"; break;
                case "t": out += "\t"; break;
                case "r": out += "\r"; break;
                case '"': out += '"'; break;
                case "\\": out += "\\"; break;
                case "/": out += "/"; break;
                case "u": {
                    const hex = acc.slice(i + 2, i + 6);
                    if (hex.length === 4 && /^[0-9a-fA-F]{4}$/.test(hex)) {
                        out += String.fromCharCode(parseInt(hex, 16));
                        i += 4;
                    }
                    break;
                }
                default: out += next;
            }
            i++; // skip the escaped char
        } else if (ch === '"') {
            break; // closing quote of the content field
        } else {
            out += ch;
        }
    }
    return out;
}

async function readAccumulatedSSE(res: Response, handlers?: StreamHandlers): Promise<string> {
    if (!res.body) throw new Error("No response body to stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let done = false;

    const handleEvent = (rawEvent: string) => {
        if (!rawEvent.startsWith("data:")) return;
        let data = rawEvent.slice(5);
        if (data.startsWith(" ")) data = data.slice(1);

        // Control events must be checked before appending to content.
        if (data === "[DONE]") {
            done = true;
            return;
        }
        if (data.startsWith("[ERROR]")) {
            throw new Error(data.slice(7).trim() || "Streaming failed");
        }
        if (data.startsWith("[PROGRESS]")) {
            const pct = parseFloat(data.slice(10).trim());
            if (!Number.isNaN(pct)) handlers?.onProgress?.(pct);
            return;
        }
        accumulated += data;
        if (handlers?.onContent) {
            const c = extractStreamingContent(accumulated);
            if (c !== null) handlers.onContent(c);
        }
    };

    while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        let sep: number;
        while ((sep = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            handleEvent(rawEvent);
            if (done) break;
        }
    }
    return accumulated;
}

export async function submitLessonMessage(
    lessonSlug: string,
    content: string,
    accessToken: string,
    handlers?: StreamHandlers
): Promise<NoteChatResponse> {
    const res = await fetch(`${BACKEND_URL}/lessons/${lessonSlug}/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content }),
    });

    if (!res.ok || !res.body) {
        const text = (!res.ok && (await res.text())) || res.statusText;
        throw new Error(`Failed to submit message: ${res.status} — ${text}`);
    }

    // Streams SSE like the notes chat. Parse the full JSON (content, session_id,
    // visualizations, …); fall back to plain text if it isn't JSON.
    const accumulated = await readAccumulatedSSE(res, handlers);
    try {
        const parsed = JSON.parse(accumulated);
        if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
            return parsed as NoteChatResponse;
        }
    } catch {
        // plain-text stream
    }
    return { content: accumulated };
}

export interface DashboardResponse {
    continue_learning: {
        session_id: string;
        lesson_slug: string;
        lesson_title: string;
        last_activity_at: string;
    } | null;
    recent_sessions: {
        session_id: string;
        lesson_slug: string;
        lesson_title: string;
        created_at: string;
    }[];
    progress: {
        lessons_completed: number;
        lessons_in_progress: number;
        lessons_started: number;
        lessons_total_published: number;
    };
    next_recommended: {
        lesson_slug: string;
        lesson_title: string;
    } | null;
}

/**
 * Fetch dashboard data for the authenticated user.
 * GET /dashboard
 */
export async function fetchDashboard(accessToken: string): Promise<DashboardResponse> {
    const res = await fetch(`${BACKEND_URL}/dashboard`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch dashboard: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Submit a drop review suggestion.
 * POST /api/reviews
 */
export async function submitReview(
    name: string,
    suggestion: string,
    accessToken?: string
): Promise<void> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${BACKEND_URL}/api/reviews`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, suggestion }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to submit review: ${res.status} — ${text}`);
    }
}

// ── NOTES API ─────────────────────────────────────────────────────────────

export interface Note {
    id: string;
    user_id: string;
    title: string;
    file_url: string;
    file_name: string;
    file_size_bytes: number;
    course_id?: string;
    created_at?: string;
}

export interface Course {
    id?: string;
    name: string;
    course_code?: string;
    description?: string;
}

export interface NoteUploadResponse {
    note_id: string;
    title: string;
    file_name: string;
    pages_extracted: number;
}

export interface NoteLessonPlanResponse {
    onboarding_message: string;
    lesson_plan?: {
        sections: { id: string; title: string; summary: string }[];
        key_terms: { term: string; definition: string }[];
    };
}

/** A visualization referenced by a [VIZ:N] token in a message's content. */
export interface Visualization {
    viz_index: number;
    concept_description?: string;
    scene_type?: string;
}

export interface NoteChatMessage {
    role: "user" | "assistant" | "developer";
    content: string;
    /** Session the message belongs to (needed to poll its [VIZ:N] videos). */
    session_id?: string;
}

export interface NoteChatRequest {
    role: "user" | "assistant";
    content: string;
    selected_sections?: string[];
}

export interface NoteChatResponse {
    content: string;
    layer?: string;
    phase_two?: boolean;
    completed?: boolean;
    session_id?: string;
    visualizations?: Visualization[];
}

/** One entry from GET /visualizations/status. */
export interface VizStatus {
    viz_index: number;
    render_status: "pending" | "stub" | "success" | "failed";
    video_url: string | null;
}

/**
 * Poll the render status of a session's visualizations.
 * GET /visualizations/status?session_id={id}[&index={n}]
 */
export async function fetchVisualizationsStatus(
    sessionId: string,
    accessToken: string,
    index?: number
): Promise<VizStatus[]> {
    const qs = new URLSearchParams({ session_id: sessionId });
    if (index !== undefined) qs.set("index", String(index));

    const res = await fetch(`${BACKEND_URL}/visualizations/status?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch visualization status: ${res.status} — ${text}`);
    }

    const data = await res.json();
    return Array.isArray(data?.visualizations) ? data.visualizations : [];
}

export interface QuizOption {
    id: string;
    text: string;
}

export interface QuizQuestion {
    id?: string;
    question: string;
    type?: string;
    /** Option texts (e.g. ["4", "5", "6"]). */
    options: string[];
    /** The correct option's text (matches one of `options`). */
    answer: string;
    explanation?: string;
    difficulty?: string;
}

export interface QuizResponse {
    quiz_id?: string;
    /** Returned by generate_quiz; sent back on submission. */
    quiz_session_id?: string;
    session_id?: string;
    questions: QuizQuestion[];
}

export interface QuizAttempt {
    question: string;
    type: string;
    user_answer: string | null;
    correct_answer: string;
    is_correct: boolean;
    difficulty: string;
    /** Optional per-question section tags for analytics. */
    selected_sections?: number[];
}

export interface QuizSubmission {
    quiz_session_id: string;
    score: number;
    total: number;
    attempts: QuizAttempt[];
}

export interface QuizSectionOption {
    id: string;
    title: string;
}

/**
 * Fetch the note's sections (id + title) for the quiz section picker.
 * GET /quiz/{note_id}
 */
export async function fetchQuizSections(
    noteId: string,
    accessToken: string
): Promise<QuizSectionOption[]> {
    const res = await fetch(`${BACKEND_URL}/quiz/${noteId}`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch quiz sections: ${res.status} — ${text}`);
    }

    const data = await res.json();
    // Section ids come back as integers; normalize to strings for the picker.
    return (Array.isArray(data) ? data : []).map((s: { id: unknown; title: string }) => ({
        id: String(s.id),
        title: s.title,
    }));
}

/**
 * Upload a PDF note
 * POST /notes/upload
 */
export async function uploadNote(
    file: File,
    title: string,
    courseId?: string,
    accessToken?: string
): Promise<NoteUploadResponse> {
    console.log("📤 Calling uploadNote API:", {
        BACKEND_URL,
        title,
        courseId,
        hasAccessToken: !!accessToken
    });
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    if (courseId) {
        formData.append("course_id", courseId);
    }

    const headers: Record<string, string> = {};
    if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const res = await fetch(`${BACKEND_URL}/notes/upload`, {
        method: "POST",
        headers,
        body: formData,
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        console.error("❌ Upload API error:", res.status, text);
        throw new Error(`Failed to upload note: ${res.status} — ${text}`);
    }

    const json = await res.json();
    console.log("✅ Upload API response:", json);
    return json;
}

/**
 * Onboard a note (generate lesson plan)
 * GET /notes/{note_id}/onboard
 */
export async function onboardNote(
    noteId: string,
    accessToken: string
): Promise<NoteLessonPlanResponse> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/onboard`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to onboard note: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Send message to note chat
 * POST /notes/{note_id}/chat
 */
export async function sendNoteChatMessage(
    noteId: string,
    request: NoteChatRequest,
    accessToken: string,
    handlers?: StreamHandlers
): Promise<NoteChatResponse> {
    // Streams SSE: each `data: <chunk>` is a slice of the JSON body; `[DONE]`
    // ends it. Content is extracted progressively (handlers.onContent); the full
    // JSON (session_id, visualizations, flags) is parsed once at [DONE].
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/chat`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(request),
    });

    if (!res.ok || !res.body) {
        const text = (!res.ok && (await res.text())) || res.statusText;
        throw new Error(`Failed to send message: ${res.status} — ${text}`);
    }

    const accumulated = await readAccumulatedSSE(res, handlers);
    try {
        return JSON.parse(accumulated) as NoteChatResponse;
    } catch {
        throw new Error("Streamed response was malformed.");
    }
}

/**
 * Get note chat history
 * GET /notes/{note_id}/history
 */
export async function fetchNoteHistory(
    noteId: string,
    accessToken: string
): Promise<NoteChatMessage[]> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/history`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch history: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Get user courses
 * GET /courses
 */
export async function fetchCourses(accessToken: string): Promise<Course[]> {
    const res = await fetch(`${BACKEND_URL}/courses`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch courses: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Create a new course
 * POST /courses
 */
export async function createCourse(
    course: Course,
    accessToken: string
): Promise<Course> {
    const res = await fetch(`${BACKEND_URL}/courses`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(course),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to create course: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Delete a course. Its notes are un-categorized (course_id → null) server-side.
 * DELETE /courses/{course_id}
 */
export async function deleteCourse(courseId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/courses/${courseId}`, {
        method: "DELETE",
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to delete course: ${res.status} — ${text}`);
    }
}

// ── PROFILE API ─────────────────────────────────────────────────────────────

export interface Profile {
    email: string | null;
    full_name: string | null;
    /** ISO date string (YYYY-MM-DD) */
    date_of_birth: string | null;
}

export interface ProfileUpdate {
    full_name?: string | null;
    date_of_birth?: string | null;
}

/**
 * Fetch the current user's profile.
 * GET /profile
 */
export async function fetchProfile(accessToken: string): Promise<Profile> {
    const res = await fetch(`${BACKEND_URL}/profile`, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch profile: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Create or update the current user's profile.
 * POST /profile
 */
export async function updateProfile(update: ProfileUpdate, accessToken: string): Promise<Profile> {
    const res = await fetch(`${BACKEND_URL}/profile`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(update),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to update profile: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Generate a quiz for a note
 * POST /notes/{note_id}/quiz
 */
export async function generateNoteQuiz(
    noteId: string,
    selectedSections: number[],
    accessToken: string
): Promise<QuizResponse> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/quiz`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ selected_sections: selectedSections }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to generate quiz: ${res.status} — ${text}`);
    }

    return res.json();
}

// ── FLASHCARDS API ──────────────────────────────────────────────────────────

export interface Flashcard {
    id?: string;
    question: string;
    answer: string;
}

export interface FlashcardsResponse {
    flashcards: Flashcard[];
    source?: "cache" | "generated";
    session_id?: string;
}

export interface FlashcardSubmission {
    session_id: string;
    total: number;
    /** How many cards the user flipped through. */
    reviewed: number;
}

/**
 * Submit a completed flashcard session (analytics/progress).
 * POST /notes/{note_id}/flashcards/submit
 * NOTE: contract mirrors the quiz submit — adjust if the backend PR differs.
 */
export async function submitFlashcardResults(
    noteId: string,
    submission: FlashcardSubmission,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/flashcards/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(submission),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to submit flashcards: ${res.status} — ${text}`);
    }
}

/**
 * Get (or create) flashcards for the selected sections.
 * POST /notes/{note_id}/flashcards
 */
export async function fetchFlashcards(
    noteId: string,
    selectedSections: number[],
    accessToken: string
): Promise<FlashcardsResponse> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/flashcards`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ selected_sections: selectedSections }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to load flashcards: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Force-generate a fresh set of flashcards for the selected sections.
 * POST /notes/{note_id}/flashcards/generate
 */
export async function generateFlashcards(
    noteId: string,
    selectedSections: number[],
    accessToken: string
): Promise<FlashcardsResponse> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/flashcards/generate`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ selected_sections: selectedSections }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to generate flashcards: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Submit quiz results for storage / analytics.
 * POST /notes/{note_id}/quiz/submit
 */
export async function submitQuizResults(
    noteId: string,
    submission: QuizSubmission,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/quiz/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(submission),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to submit quiz: ${res.status} — ${text}`);
    }
}
