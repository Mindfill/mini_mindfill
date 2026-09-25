/**
 * Backend API client for TECHCESS lesson chat.
 * All requests attach the Supabase JWT as a Bearer token.
 */

import { getDeviceToken } from "./device";

export const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://mindfill-api.onrender.com").trim().replace(/[`'"]/g, "");

/**
 * Single place every authenticated request builds its headers — attaches the
 * Supabase bearer token and, when one is registered, the device token used
 * for the multi-device limit (Feature 01).
 */
export function authHeaders(accessToken?: string, json = false): Record<string, string> {
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
    /** Every model chunk as it arrives, accumulated — for fields other than content. */
    onRaw?: (accumulated: string) => void;
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

/**
 * Server-authoritative fields sent just before [DONE] as `data: [FINAL] {json}`.
 * `content` has the server-assigned [VIZ:N] numbers (the streamed JSON holds
 * the model's own, which can collide with earlier visuals); `session_id` isn't
 * in the model's JSON at all.
 */
interface StreamFinal {
    content?: string;
    session_id?: string;
}

function applyFinal(response: NoteChatResponse, final: StreamFinal | null): NoteChatResponse {
    if (!final) return response;
    return {
        ...response,
        ...(typeof final.content === "string" ? { content: final.content } : {}),
        ...(final.session_id ? { session_id: final.session_id } : {}),
    };
}

export async function readAccumulatedSSE(
    res: Response,
    handlers?: StreamHandlers
): Promise<{ text: string; final: StreamFinal | null }> {
    if (!res.body) throw new Error("No response body to stream");
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let final: StreamFinal | null = null;
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
        if (data.startsWith("[FINAL]")) {
            try {
                final = JSON.parse(data.slice(7).trim()) as StreamFinal;
            } catch {
                // fall back to the streamed JSON
            }
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
        handlers?.onRaw?.(accumulated);
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
    return { text: accumulated, final };
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
    const { text: accumulated, final } = await readAccumulatedSSE(res, handlers);
    try {
        const parsed = JSON.parse(accumulated);
        if (parsed && typeof parsed === "object" && typeof parsed.content === "string") {
            return applyFinal(parsed as NoteChatResponse, final);
        }
    } catch {
        // plain-text stream
    }
    return applyFinal({ content: accumulated }, final);
}

export interface StreakData {
    current_streak: number;
    longest_streak: number;
    last_active_date: string | null;
}

export interface UsageDay {
    date: string;
    minutes: number;
}

export interface UsageGraph {
    days: UsageDay[];
    /** Minutes this period minus the previous one — what the dashboards show. */
    change_minutes: number;
    change_percent: number;
    change_direction: "up" | "down" | "same";
    sessions_this_week: number;
    /** Sessions this week minus last week. */
    sessions_change: number;
    sessions_change_percent: number;
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
        last_activity_at: string;
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
    recent_notes: {
        note_id: string;
        title: string;
        last_opened_at: string;
    }[];
    streak: StreakData;
    usage_graph: UsageGraph;
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

export interface SubsectionProgress {
    subsection_id: string;
    subsection_title: string;
    chapter_title: string;
    section_label: string;
}

export interface ChapterRing {
    chapter_id: string;
    chapter_title: string;
    percent_complete: number;
    is_complete: boolean;
}

export interface StrengthWeakness {
    chapter_title: string;
    signal: "strength" | "weakness";
}

export interface SecondaryDashboardResponse {
    continue_learning: SubsectionProgress | null;
    chapter_rings: ChapterRing[];
    streak: StreakData;
    usage_graph: UsageGraph;
    strengths: StrengthWeakness[];
    weaknesses: StrengthWeakness[];
    most_pressing: StrengthWeakness | null;
    sessions_this_week: number;
    /** Sessions this week minus last week. */
    sessions_change: number;
    sessions_change_percent: number;
    days_since_last_session: number | null;
    recently_completed_chapters: string[];
    next_chapter_preview: string | null;
}

export async function fetchSecondaryDashboard(accessToken: string): Promise<SecondaryDashboardResponse> {
    const res = await fetch(`${BACKEND_URL}/secondary/dashboard`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch secondary dashboard: ${res.status} — ${text}`);
    }
    return res.json();
}

export type UsagePeriod = "daily" | "weekly";

export interface UsageGraphWindow {
    period: UsagePeriod;
    days: UsageDay[];
    change_minutes: number;
    change_percent: number;
    change_direction: "up" | "down" | "same";
}

/** Backs the secondary dashboard graph's daily/weekly toggle — "daily" is the
 * same 7-day window the dashboard payload already carries, so only "weekly"
 * actually needs fetching. */
export async function fetchSecondaryUsageGraph(
    period: UsagePeriod,
    accessToken: string,
): Promise<UsageGraphWindow> {
    const res = await fetch(`${BACKEND_URL}/secondary/usage-graph?period=${period}`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch usage graph: ${res.status} — ${text}`);
    }
    return res.json();
}

export interface StudentSummary {
    student_id: string;
    student_name: string;
    class_level: string;
    current_streak: number;
    study_minutes_this_week: number;
    study_minutes_change_percent: number;
    /** Minutes this week minus last week — what the card shows. */
    study_minutes_change: number;
    current_chapter: string;
    chapter_progress_percent: number;
    top_strengths: string[];
    top_weaknesses: string[];
    resolved_weaknesses: string[];
    last_active_date: string | null;
    sessions_this_week: number;
}

export interface ParentDashboardResponse {
    students: StudentSummary[];
    generated_at: string;
}

export async function fetchParentDashboard(accessToken: string): Promise<ParentDashboardResponse> {
    const res = await fetch(`${BACKEND_URL}/parent/dashboard`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch parent dashboard: ${res.status} — ${text}`);
    }
    return res.json();
}

export interface SchoolOverview {
    total_students: number;
    active_this_week: number;
    avg_study_minutes_this_week: number;
    avg_streak: number;
    chapters_completed_percent: number;
}

export interface StudentRow {
    student_id: string;
    student_name: string;
    class_level: string;
    sessions_this_week: number;
    current_chapter: string;
    top_strengths: string[];
    resolved_weaknesses: string[];
    last_active_date: string | null;
    status: "active" | "inactive" | "at_risk";
}

export interface WeakTopic {
    chapter_title: string;
    struggle_count: number;
}

export interface SchoolDashboardResponse {
    school_name: string;
    overview: SchoolOverview;
    students: StudentRow[];
    weak_topics: WeakTopic[];
    generated_at: string;
}

export async function fetchSchoolDashboard(accessToken: string): Promise<SchoolDashboardResponse> {
    const res = await fetch(`${BACKEND_URL}/school/dashboard`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch school dashboard: ${res.status} — ${text}`);
    }
    return res.json();
}

export async function fetchSchoolMonthlyReport(accessToken: string): Promise<SchoolDashboardResponse> {
    const res = await fetch(`${BACKEND_URL}/school/report/monthly`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch school report: ${res.status} — ${text}`);
    }
    return res.json();
}

/**
 * Record page-visible active time for the usage-time dashboard graphs.
 * POST /activity/heartbeat. `keepalive` lets the request outlive a page
 * unload/tab-hide (the flush that fires on those events).
 */
export async function postActivityHeartbeat(
    seconds: number,
    accessToken: string,
    keepalive = false
): Promise<void> {
    await fetch(`${BACKEND_URL}/activity/heartbeat`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ seconds }),
        keepalive,
    });
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

/** A visualization referenced by a [VIZ:N] token in a message's content. */
export interface Visualization {
    viz_index: number;
    concept_description?: string;
    scene_type?: string;
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
/** The same file was already uploaded — carries the existing note so the UI can open it. */
export class DuplicateNoteError extends Error {
    constructor(message: string, public noteId: string, public noteTitle: string) {
        super(message);
        this.name = "DuplicateNoteError";
    }
}

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
        if (res.status === 409) {
            try {
                const detail = JSON.parse(text).detail;
                if (detail?.code === "duplicate_note") {
                    throw new DuplicateNoteError(detail.message, detail.note_id, detail.title);
                }
            } catch (e) {
                if (e instanceof DuplicateNoteError) throw e;
            }
        }
        throw new Error(`Failed to upload note: ${res.status} — ${text}`);
    }

    const json = await res.json();
    console.log("✅ Upload API response:", json);
    return json;
}

/** §2.3 — a real figure from the student's notes, shown inline by [FIGURE:n]. */
export interface NoteFigure {
    number: number;
    url: string;
    page: number;
    label: string | null;
    description: string | null;
    section_index: number;
    section_title: string | null;
}

export async function fetchNoteFigures(noteId: string, accessToken: string): Promise<NoteFigure[]> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}/figures`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch figures: ${res.status} — ${text}`);
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
 * Delete a note and everything built from it (lessons, chats, quizzes,
 * flashcards, its PDF and figures). Irreversible.
 * DELETE /notes/{note_id}
 */
export async function deleteNote(noteId: string, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/notes/${noteId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to delete note: ${res.status} — ${text}`);
    }
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
    /** 18+ today, by date of birth. Minors never see or get the training opt-in. */
    training_consent_eligible: boolean;
    training_consent: boolean;
}

/** Opt in/out of anonymised training copies of deleted notes (adults only). */
export async function setTrainingConsent(consent: boolean, accessToken: string): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/profile/training-consent`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ consent }),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to save training consent: ${res.status} — ${text}`);
    }
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
export interface MySubscription {
    status: "active" | "lapsed" | "cancelled" | "expired" | null;
    plan_type: string | null;
    current_period_end: string | null;
    /** Cancelled, but still inside the period they paid for. */
    cancel_at_period_end: boolean;
    has_access: boolean;
    /** How access was granted: a purchase, or a redeemed access code. */
    source: "paystack" | "promo" | null;
}

/** GET /subscriptions/me — drives the billing panel's Cancel / Resume / Subscribe. */
export async function fetchMySubscription(accessToken: string): Promise<MySubscription> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/me`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) throw new Error(await parseErrorDetail(res));
    return res.json();
}

export async function cancelSubscription(
    accessToken: string,
): Promise<{ message: string; access_until: string | null }> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/cancel`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });

    if (!res.ok) {
        // The backend now returns a usable reason (already cancelled, provider
        // unreachable, and so on) rather than one opaque 502.
        throw new Error(await parseErrorDetail(res));
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
export type UserRole = "student" | "parent" | "school_admin" | "admin";

export interface OnboardingStatus {
    user_type: UserType;
    onboarding_step: number;
    onboarding_completed: boolean;
    terms_accepted: boolean;
    full_name: string | null;
    role: UserRole;
    /** Drives the OpenDyslexic font app-wide; set during onboarding. */
    has_dyslexia?: boolean;
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
    /** Set when the student picked a school from the search results — this is
     * what enrols them into that school's dashboard. */
    school_id?: string;
    life_goals?: string[];
    education_sentiment?: string;
    has_dyslexia?: boolean;
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
    has_dyslexia?: boolean;
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
/** `trainingConsent` is the separate, unticked-by-default opt-in; the server
 *  ignores it for anyone under 18. */
export async function acceptOnboardingTerms(accessToken: string, trainingConsent = false): Promise<void> {
    const res = await fetch(`${BACKEND_URL}/onboarding/accept-terms`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ training_consent: trainingConsent }),
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
/**
 * The caller isn't a family-plan owner, so member management doesn't apply to
 * them. Distinct from a failure: the UI hides the section for this, but shows
 * a retry for anything else. Raised on the 403 from require_subscription_owner.
 */
export class NotFamilyPlanError extends Error {
    constructor(message = "This plan doesn't include additional members.") {
        super(message);
        this.name = "NotFamilyPlanError";
    }
}

export async function fetchSubscriptionMembers(accessToken: string): Promise<MembersResponse> {
    const res = await fetch(`${BACKEND_URL}/subscriptions/members`, {
        headers: authHeaders(accessToken),
    });

    if (res.status === 403) throw new NotFamilyPlanError(await parseErrorDetail(res));
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
const PROMO_CODE_MESSAGES = {
    promo_code_invalid: "That code isn't valid.",
    promo_code_expired: "This code has expired or reached its limit.",
    promo_code_already_redeemed: "You've already used this code.",
} as const;

export class PromoCodeError extends Error {
    constructor(public code: keyof typeof PROMO_CODE_MESSAGES) {
        super(PROMO_CODE_MESSAGES[code]);
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
    // 409 = this account already redeemed this code. Used to surface as a 500
    // from the unique constraint, so the student just saw "something went wrong".
    if (res.status === 409) throw new PromoCodeError("promo_code_already_redeemed");
    if (!res.ok) {
        throw new Error(`Failed to redeem promo code: ${res.status} — ${await parseErrorDetail(res)}`);
    }

    return res.json();
}

// ── ADMIN API (schools + promo codes — role=admin only) ─────────────────────

export interface AdminSchool {
    id: string;
    school_name: string;
    city: string | null;
    state: string | null;
    contact_name: string | null;
    contact_email: string | null;
    contact_phone: string | null;
    is_active: boolean;
}

export async function fetchAdminSchools(accessToken: string): Promise<AdminSchool[]> {
    const res = await fetch(`${BACKEND_URL}/admin/schools`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch schools: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface ImportIssue {
    entity: string;
    row: string;
    id: string;
    reason: string;
}

export interface ContentImportReport {
    dry_run: boolean;
    filename: string;
    sheets: string[];
    /** Size and hash of the bytes the server received — identical values
     * across two uploads mean the same file content was sent both times. */
    file_bytes: number;
    file_sha256: string;
    counts: Record<string, {
        created_or_updated: number;
        /** Rows the database doesn't have yet, by slug. */
        new: number;
        /** Rows already present — an upsert refreshes their content. */
        updated: number;
        skipped: number;
        rejected: number;
    }>;
    rejected: ImportIssue[];
    skipped: ImportIssue[];
    blank_rows: Record<string, number>;
    warnings: string[];
}

/**
 * Upload an authoring workbook to the curriculum tables.
 * POST /admin/content/import — dryRun parses and validates without writing.
 */
export async function importCurriculumContent(
    file: File,
    dryRun: boolean,
    accessToken: string,
): Promise<ContentImportReport> {
    const body = new FormData();
    body.append("file", file);

    const res = await fetch(`${BACKEND_URL}/admin/content/import?dry_run=${dryRun}`, {
        method: "POST",
        // No Content-Type header — the browser must set the multipart boundary.
        headers: { Authorization: `Bearer ${accessToken}` },
        body,
    });
    if (!res.ok) {
        throw new Error(`Import failed: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

// ── ADMIN — curriculum static visuals (Feature 02) ──────────────────────────

export const SCENE_TYPES = [
    "SHAPE_DIAGRAM",
    "GRAPH_PLOT",
    "NUMBER_LINE",
    "FORMULA_BREAKDOWN",
    "SPATIAL_DIAGRAM",
] as const;
export type SceneType = (typeof SCENE_TYPES)[number];

export type VisualApprovalStatus = "pending" | "rendered" | "approved";

/** One authored manim prompt on a curriculum subsection. */
export interface CurriculumVisual {
    subsection_id: string;
    subsection_slug: string | null;
    subsection_title: string | null;
    subsection_status: string | null;
    chapter_id: string | null;
    chapter_title: string | null;
    chapter_number: number | null;
    section_label: string | null;
    section_number: number | null;
    display_order: number | null;
    index: number;
    prompt: string;
    position: string | null;
    approval_status: VisualApprovalStatus;
    storage_url: string | null;
    scene_type: SceneType | null;
    /** null = never rendered (or reset by a prompt edit). */
    render_status: "rendering" | "success" | "failed" | null;
    render_error: string | null;
    render_attempts: number;
    last_rendered_at: string | null;
}

/** GET /admin/curriculum/visuals — every authored visual, in lesson order. */
export async function fetchCurriculumVisuals(accessToken: string): Promise<CurriculumVisual[]> {
    const res = await fetch(`${BACKEND_URL}/admin/curriculum/visuals`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to load visuals: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    const data = await res.json();
    return Array.isArray(data?.visuals) ? data.visuals : [];
}

/** GET /admin/curriculum/visuals/status — poll while render_status is "rendering". */
export async function fetchCurriculumVisualStatus(
    subsectionId: string,
    index: number,
    accessToken: string,
): Promise<CurriculumVisual> {
    const qs = new URLSearchParams({ subsection_id: subsectionId, index: String(index) });
    const res = await fetch(`${BACKEND_URL}/admin/curriculum/visuals/status?${qs.toString()}`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to check render: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

async function postCurriculumVisual(path: string, method: "POST" | "PUT", body: object, accessToken: string, action: string) {
    const res = await fetch(`${BACKEND_URL}/admin/curriculum/visuals/${path}`, {
        method,
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(body),
    });
    if (!res.ok) {
        throw new Error(`${action}: ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

/** Starts a fresh render. Returns once the render is queued. */
export function renderCurriculumVisual(subsectionId: string, index: number, sceneType: SceneType, accessToken: string) {
    return postCurriculumVisual("render", "POST", { subsection_id: subsectionId, index, scene_type: sceneType }, accessToken, "Couldn't start render");
}

/** Saves an edited prompt. Discards the current render and resets approval. */
export function editCurriculumVisualPrompt(subsectionId: string, index: number, prompt: string, accessToken: string) {
    return postCurriculumVisual("prompt", "PUT", { subsection_id: subsectionId, index, prompt }, accessToken, "Couldn't save prompt");
}

export function approveCurriculumVisual(subsectionId: string, index: number, accessToken: string) {
    return postCurriculumVisual("approve", "POST", { subsection_id: subsectionId, index }, accessToken, "Couldn't approve");
}

export function unapproveCurriculumVisual(subsectionId: string, index: number, accessToken: string) {
    return postCurriculumVisual("unapprove", "POST", { subsection_id: subsectionId, index }, accessToken, "Couldn't unapprove");
}

export interface AdminSchoolCreateInput {
    school_name: string;
    city?: string;
    state?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
}

export async function createAdminSchool(input: AdminSchoolCreateInput, accessToken: string): Promise<AdminSchool> {
    const res = await fetch(`${BACKEND_URL}/admin/schools`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        throw new Error(`Failed to create school: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface AdminSchoolAdmin {
    user_id: string;
    full_name: string | null;
    linked_at: string | null;
}

export async function fetchSchoolAdmins(schoolId: string, accessToken: string): Promise<AdminSchoolAdmin[]> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/admins`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch school admins: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface AdminSchoolInvite {
    id: string;
    email: string;
    created_at: string;
}

/** Pending invites — people invited to manage a school who haven't signed up
 * yet. The row clears itself when they create their account. */
export async function fetchSchoolAdminInvites(schoolId: string, accessToken: string): Promise<AdminSchoolInvite[]> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/admin-invites`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch invites: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export async function cancelSchoolAdminInvite(
    schoolId: string,
    inviteId: string,
    accessToken: string
): Promise<{ status: string }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/admin-invites/${inviteId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

/** Assigns the school admin when the person already has an account, and sends
 * an invite when they don't — `status` says which happened. */
export async function assignSchoolAdmin(
    schoolId: string,
    email: string,
    accessToken: string
): Promise<{ status: "assigned" | "invited"; user_id?: string; email?: string }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/admins`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ email }),
    });
    if (!res.ok) {
        throw new Error(`Failed to assign school admin: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

// ── School students (enrolment) ─────────────────────────────────────────────

// ── School: one student's detail (school admin drill-down) ─────────────────

export interface SchoolStudentStruggle {
    subsection_title: string;
    chapter_title: string;
    comprehension_depth: string | null;
    struggle_points: string[];
    created_at: string;
}

export interface SchoolStudentDetail {
    student_id: string;
    student_name: string;
    class_level: string;
    status: StudentRow["status"];
    current_chapter: string | null;
    current_subsection: string | null;
    current_chapter_progress_percent: number;
    chapter_rings: { chapter_id: string; chapter_title: string; percent_complete: number; is_complete: boolean }[];
    streak: { current_streak: number; longest_streak: number; last_active_date: string | null };
    /** The snapshot's own weekly rollup (minutes), not the graph payload. */
    usage_week: { current_sum: number; previous_sum?: number; change_percent?: number };
    sessions_this_week: number;
    /** Sessions this week minus last week. */
    sessions_change: number;
    sessions_change_percent: number;
    days_since_last_session: number | null;
    last_active_date: string | null;
    strengths: string[];
    weaknesses: string[];
    resolved_weaknesses: string[];
    recent_struggles: SchoolStudentStruggle[];
    generated_at: string;
}

export async function fetchSchoolStudentDetail(studentId: string, accessToken: string): Promise<SchoolStudentDetail> {
    const res = await fetch(`${BACKEND_URL}/school/students/${studentId}`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to load student: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

/** The same drill-down, for a student linked to the signed-in parent. Uni
 * students come back in the same shape with chapter/struggle fields empty. */
export async function fetchParentStudentDetail(studentId: string, accessToken: string): Promise<SchoolStudentDetail> {
    const res = await fetch(`${BACKEND_URL}/parent/students/${studentId}`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to load student: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface AdminSchoolStudent {
    student_id: string;
    full_name: string | null;
    class_level: string;
    is_active: boolean;
    enrolled_at: string;
}

/** A student whose typed school name matches this school but who was never
 * linked — an admin confirms these before they're enrolled. */
export interface AdminSuggestedStudent {
    student_id: string;
    full_name: string | null;
    typed_school_name: string | null;
    class_level: string | null;
}

export async function fetchSchoolStudents(
    schoolId: string,
    accessToken: string
): Promise<{ students: AdminSchoolStudent[]; suggested: AdminSuggestedStudent[] }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/students`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch students: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export async function enrolSchoolStudent(
    schoolId: string,
    email: string,
    accessToken: string,
    classLevel?: string
): Promise<{ status: string; student_id: string; full_name: string | null }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/students`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ email, class_level: classLevel }),
    });
    if (!res.ok) {
        throw new Error(`${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export async function linkSuggestedStudents(
    schoolId: string,
    studentIds: string[],
    accessToken: string
): Promise<{ linked: number; requested: number }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/students/link`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify({ student_ids: studentIds }),
    });
    if (!res.ok) {
        throw new Error(`${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export async function unenrolSchoolStudent(
    schoolId: string,
    studentId: string,
    accessToken: string
): Promise<{ status: string }> {
    const res = await fetch(`${BACKEND_URL}/admin/schools/${schoolId}/students/${studentId}`, {
        method: "DELETE",
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface AdminPromoCode {
    id: string;
    code: string;
    description: string | null;
    plan_type: string;
    access_days: number;
    max_uses: number | null;
    uses_count: number;
    expires_at: string | null;
    is_active: boolean;
    created_at: string;
}

export async function fetchAdminPromoCodes(accessToken: string): Promise<AdminPromoCode[]> {
    const res = await fetch(`${BACKEND_URL}/admin/promo/list`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to fetch promo codes: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export interface AdminPromoCreateInput {
    code: string;
    description?: string;
    plan_type: string;
    access_days: number;
    max_uses?: number;
    expires_at?: string;
}

export async function createAdminPromoCode(input: AdminPromoCreateInput, accessToken: string): Promise<AdminPromoCode> {
    const res = await fetch(`${BACKEND_URL}/admin/promo/create`, {
        method: "POST",
        headers: authHeaders(accessToken, true),
        body: JSON.stringify(input),
    });
    if (!res.ok) {
        throw new Error(`Failed to create promo code: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}

export async function toggleAdminPromoCode(promoId: string, accessToken: string): Promise<AdminPromoCode> {
    const res = await fetch(`${BACKEND_URL}/admin/promo/${promoId}/toggle`, {
        method: "PATCH",
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        throw new Error(`Failed to toggle promo code: ${res.status} — ${await parseErrorDetail(res)}`);
    }
    return res.json();
}
