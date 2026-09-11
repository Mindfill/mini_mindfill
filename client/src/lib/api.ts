/**
 * Backend API client for TECHCESS lesson chat.
 * All requests attach the Supabase JWT as a Bearer token.
 */

import { getDeviceToken } from "./device";

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://mindfill-api.onrender.com").trim().replace(/[`'"]/g, "");

/**
 * Single place every authenticated request builds its headers — attaches the
 * Supabase bearer token and, when one is registered, the device token used
 * for the multi-device limit (Feature 01).
 */
function authHeaders(accessToken?: string, json = false): Record<string, string> {
    const headers: Record<string, string> = {};
    if (json) headers["Content-Type"] = "application/json";
    if (accessToken) headers["Authorization"] = `Bearer ${accessToken}`;
    const deviceToken = getDeviceToken();
    if (deviceToken) headers["X-Device-Token"] = deviceToken;
    return headers;
}

/** Thrown when an API call returns HTTP 402 — the user is out of credits. */
export class OutOfCreditsError extends Error {
    constructor(message = "You've run out of credits.") {
        super(message);
        this.name = "OutOfCreditsError";
    }
}

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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ content }),
    });

    if (res.status === 402) throw new OutOfCreditsError();
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
        headers: authHeaders(accessToken),
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
    const headers = authHeaders(accessToken, true);

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
    render_status: "pending" | "rendering" | "stub" | "complete" | "success" | "failed";
    video_url: string | null;
    /** How many times the render has been retried (drives retrying vs permanent-fail). */
    retry_count?: number;
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
        headers: authHeaders(accessToken),
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
    quiz_type?: "objective" | "theory";
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
    quiz_type?: "objective" | "theory";
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
        headers: authHeaders(accessToken),
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

    const headers = authHeaders(accessToken);

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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(request),
    });

    if (res.status === 402) throw new OutOfCreditsError();
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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken, true),
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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken),
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(update),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to update profile: ${res.status} — ${text}`);
    }

    return res.json();
}

/**
 * Link (or invite) a parent by email.
 * POST /profile/link-parent  →  { status: "linked" | "invited" }
 */
export async function linkParent(
    parentEmail: string,
    accessToken: string
): Promise<{ status: "linked" | "invited" }> {
    const res = await fetch(`${BACKEND_URL}/profile/link-parent`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ parent_email: parentEmail }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to link parent: ${res.status} — ${text}`);
    }

    return res.json();
}

// ── BILLING API ─────────────────────────────────────────────────────────────

export type PaymentPlan =
    | "pro_monthly"
    | "pro_yearly"
    | "secondary_individual_monthly"
    | "secondary_individual_yearly"
    | "secondary_family_monthly"
    | "secondary_family_yearly";

/**
 * Start a checkout for the chosen plan.
 * POST /payments/initiate  →  { payment_url }
 * The caller redirects the browser to payment_url.
 */
export async function initiatePayment(
    plan: PaymentPlan,
    accessToken: string
): Promise<{ payment_url: string }> {
    const res = await fetch(`${BACKEND_URL}/payments/initiate`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ plan }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to initiate payment: ${res.status} — ${text}`);
    }

    const data = await res.json();
    if (!data?.payment_url) throw new Error("Payment provider did not return a URL");
    return data;
}

/**
 * Cancel the active subscription.
 * DELETE /subscriptions/cancel
 */
export async function cancelSubscription(accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/cancel`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to cancel subscription: ${res.status} — ${text}`);
    }
}

/**
 * Generate a quiz for a note
 * POST /notes/{note_id}/quiz
 */
export async function generateNoteQuiz(
    noteId: string,
    selectedSections: number[],
    accessToken: string,
    quizType: "objective" | "theory" = "objective"
): Promise<QuizResponse> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/quiz`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ selected_sections: selectedSections, quiz_type: quizType }),
    });

    if (res.status === 402) throw new OutOfCreditsError();
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to generate quiz: ${res.status} — ${text}`);
    }

    return res.json();
}

export interface TheoryExplainRequest {
    question: string;
    options: string[];
    student_answer: string;
    correct_answer: string;
    explanation: string;
    difficulty?: string;
    history?: { role: string; content: string }[];
}

/**
 * Get a personalized explanation for a wrong theory-quiz answer.
 * POST /notes/{note_id}/quiz/explain
 */
export async function explainTheoryAnswer(
    noteId: string,
    payload: TheoryExplainRequest,
    accessToken: string
): Promise<{ message: string }> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/quiz/explain`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch explanation: ${res.status} — ${text}`);
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
        headers: authHeaders(accessToken, true),
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ selected_sections: selectedSections }),
    });

    if (res.status === 402) throw new OutOfCreditsError();
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ selected_sections: selectedSections }),
    });

    if (res.status === 402) throw new OutOfCreditsError();
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
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(submission),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to submit quiz: ${res.status} — ${text}`);
    }
}

// ── ONBOARDING API ──────────────────────────────────────────────────────────

/** Thrown when a DOB screen submission fails the under-13 gate. */
export class UnderAgeError extends Error {
    constructor(message = "You need to be 13 or older to use Techcess.") {
        super(message);
        this.name = "UnderAgeError";
    }
}

async function parseErrorDetail(res: Response): Promise<string> {
    try {
        const body = await res.json();
        if (typeof body?.detail === "string") return body.detail;
    } catch {
        // not JSON — fall through
    }
    return res.statusText;
}

export type UserType = "secondary" | "university" | "parent";

export interface OnboardingStatus {
    user_type: UserType;
    onboarding_step: number;
    onboarding_completed: boolean;
    terms_accepted: boolean;
    full_name: string | null;
}

/**
 * Fetch the current user's onboarding progress. Also triggers the backend's
 * post-signup hook (resolving any pending parent-link / subscription invite)
 * the first time it's called for a user.
 * GET /onboarding/status
 */
export async function fetchOnboardingStatus(accessToken: string): Promise<OnboardingStatus> {
    const res = await fetch(`${BACKEND_URL}/onboarding/status`, {
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch onboarding status: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}

/**
 * Screen 1 of every flow. Also used when the user goes back and changes
 * their answer — resets onboarding_step and clears the other type's fields.
 * POST /onboarding/user-type
 */
export async function setUserType(userType: UserType, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/user-type`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ user_type: userType }),
    });

    if (!res.ok) {
        throw new Error(`Failed to set user type: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

export interface NotificationPrefs {
    whatsapp?: boolean;
    email?: boolean;
}

export interface SecondaryOnboardingInput {
    screen: number;
    full_name?: string;
    /** ISO date string (YYYY-MM-DD) */
    date_of_birth?: string;
    secondary_class_level?: "SS1" | "SS2" | "SS3";
    school_name?: string;
    life_goals?: string[];
    education_sentiment?: string;
    notification_prefs?: NotificationPrefs;
    phone_number?: string;
}

/**
 * Save one screen of the secondary-school onboarding flow (incremental save).
 * POST /onboarding/secondary
 * Throws UnderAgeError if date_of_birth puts the student under 13.
 */
export async function saveSecondaryOnboarding(
    input: SecondaryOnboardingInput,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/secondary`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(input),
    });

    if (res.status === 422) throw new UnderAgeError();
    if (!res.ok) {
        throw new Error(`Failed to save onboarding screen: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

export interface UniversityOnboardingInput {
    screen: number;
    full_name?: string;
    /** ISO date string (YYYY-MM-DD) */
    date_of_birth?: string;
    institution_name?: string;
    course_of_study?: string;
    initial_struggle_topics?: string[];
    education_sentiment?: string;
    notification_prefs?: NotificationPrefs;
    phone_number?: string;
}

/**
 * Save one screen of the university onboarding flow (incremental save).
 * POST /onboarding/university
 * Throws UnderAgeError if date_of_birth puts the student under 13.
 */
export async function saveUniversityOnboarding(
    input: UniversityOnboardingInput,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/university`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(input),
    });

    if (res.status === 422) throw new UnderAgeError();
    if (!res.ok) {
        throw new Error(`Failed to save onboarding screen: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

export interface ParentOnboardingInput {
    screen: number;
    full_name?: string;
    whatsapp_number?: string;
}

/**
 * Save one screen of the parent onboarding flow (incremental save).
 * POST /onboarding/parent
 */
export async function saveParentOnboarding(
    input: ParentOnboardingInput,
    accessToken: string
): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/parent`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(input),
    });

    if (!res.ok) {
        throw new Error(`Failed to save onboarding screen: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

/**
 * Record terms + accuracy acceptance (the final gate screen in every flow).
 * POST /onboarding/accept-terms
 */
export async function acceptOnboardingTerms(accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/accept-terms`, {
        method: "POST",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to accept terms: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

/**
 * Marks onboarding as complete. Called from whichever action ends a flow:
 * uni/parent's final screen, the "free chapter" / invited-member paywall
 * choices. (Promo redemption marks completion itself, server-side.)
 * POST /onboarding/complete
 */
export async function completeOnboarding(accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/complete`, {
        method: "POST",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to complete onboarding: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

// ── DEVICES API (Feature 01) ────────────────────────────────────────────────

export interface DeviceEntry {
    device_token: string;
    device_name: string | null;
    last_seen_at: string;
    registered_at: string;
}

/**
 * List this user's registered devices.
 * GET /devices
 */
export async function fetchDevices(accessToken: string): Promise<DeviceEntry[]> {
    const res = await fetch(`${BACKEND_URL}/devices`, {
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch devices: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    const data = await res.json();
    return data.devices ?? [];
}

/**
 * Deregister a device, freeing its slot immediately.
 * DELETE /devices/{device_token}
 */
export async function deregisterDevice(deviceToken: string, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/devices/${encodeURIComponent(deviceToken)}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to remove device: ${res.status} — ${await parseErrorDetail(res)}`);
    }
}

// ── SUBSCRIPTION MEMBERS API (Feature 01) ───────────────────────────────────

export interface SubscriptionMember {
    user_id: string;
    status: string;
    invited_at: string | null;
    joined_at: string | null;
    full_name: string | null;
}

export interface PendingInvite {
    invited_email: string;
    expires_at: string;
}

export interface MembersResponse {
    members: SubscriptionMember[];
    pending_invites: PendingInvite[];
}

/**
 * Owner-only: list active members + pending invites on the family plan.
 * GET /subscriptions/members
 */
export async function fetchSubscriptionMembers(accessToken: string): Promise<MembersResponse> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/members`, {
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to fetch members: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}

/**
 * Owner-only: invite a member by email (same endpoint resends if already pending).
 * POST /subscriptions/invite
 */
export async function inviteSubscriptionMember(
    email: string,
    accessToken: string
): Promise<{ status: "invited" | "resent" }> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/invite`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ email }),
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res));
    }

    return res.json();
}

/**
 * Accept a family-plan invite (existing users — new signups resolve
 * automatically via the post-signup hook).
 * POST /subscriptions/invite/accept
 */
export async function acceptSubscriptionInvite(token: string, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/invite/accept`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ token }),
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res));
    }
}

/**
 * Owner-only: remove a member from the family plan.
 * DELETE /subscriptions/members/{user_id}
 */
export async function removeSubscriptionMember(memberUserId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/members/${memberUserId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(await parseErrorDetail(res));
    }
}

export interface SchoolResult {
    id: string;
    school_name: string;
    city: string | null;
    state: string | null;
}

/**
 * Autocomplete suggestions for the secondary school screen.
 * GET /onboarding/schools/search?q=
 */
export async function searchSchools(query: string, accessToken: string): Promise<SchoolResult[]> {
    const res = await fetch(`${BACKEND_URL}/onboarding/schools/search?q=${encodeURIComponent(query)}`, {
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`School search failed: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}

export interface PaywallStatus {
    is_member: boolean;
    owner_name: string | null;
}

/**
 * Tells the Paywall screen whether to show the normal paywall or the
 * "you're covered" invited-member confirmation.
 * GET /onboarding/paywall-status
 */
export async function fetchPaywallStatus(accessToken: string): Promise<PaywallStatus> {
    const res = await fetch(`${BACKEND_URL}/onboarding/paywall-status`, {
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        throw new Error(`Failed to check paywall status: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}

/** Thrown when a promo code is invalid, inactive, or past its uses/expiry. */
export class PromoCodeError extends Error {
    constructor(public code: "promo_code_invalid" | "promo_code_expired") {
        super(code === "promo_code_expired" ? "This code has expired or reached its limit." : "That code isn't valid.");
        this.name = "PromoCodeError";
    }
}

/**
 * Redeem a pilot-school promo code. Marks onboarding complete on success.
 * POST /onboarding/promo
 */
export async function redeemPromoCode(
    code: string,
    accessToken: string
): Promise<{ access_until: string }> {
    const res = await fetch(`${BACKEND_URL}/onboarding/promo`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ code }),
    });

    if (res.status === 404) throw new PromoCodeError("promo_code_invalid");
    if (res.status === 410) throw new PromoCodeError("promo_code_expired");
    if (!res.ok) {
        throw new Error(`Failed to redeem promo code: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}
