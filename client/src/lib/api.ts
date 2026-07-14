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
export async function submitLessonMessage(
    lessonSlug: string,
    content: string,
    accessToken: string
): Promise<ChatMessage> {
    const res = await fetch(`${BACKEND_URL}/lessons/${lessonSlug}/submit`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ content }),
    });

    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to submit message: ${res.status} — ${text}`);
    }

    return res.json();
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

export interface NoteChatMessage {
    role: "user" | "assistant" | "developer";
    content: string;
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
    accessToken: string
): Promise<NoteChatResponse> {
    // The chat endpoint streams Server-Sent Events: each `data: <chunk>` is a
    // slice of the JSON body; `data: [DONE]` ends the stream (`data: [ERROR] …`
    // on failure). We accumulate the chunks and parse the full JSON at [DONE].
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

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let accumulated = "";
    let done = false;

    const handleEvent = (rawEvent: string) => {
        if (!rawEvent.startsWith("data:")) return;
        // Everything after "data:" (with one optional leading space) is the chunk,
        // preserving any internal characters.
        let data = rawEvent.slice(5);
        if (data.startsWith(" ")) data = data.slice(1);

        if (data === "[DONE]") {
            done = true;
        } else if (data.startsWith("[ERROR]")) {
            throw new Error(data.slice(7).trim() || "Streaming failed");
        } else {
            accumulated += data;
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
