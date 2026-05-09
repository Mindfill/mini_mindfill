/**
 * Backend API client for TECHCESS lesson chat.
 * All requests attach the Supabase JWT as a Bearer token.
 */

const BACKEND_URL =
    import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

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
    const res = await fetch(`${BACKEND_URL}/lessons/${lessonSlug}/history`, {
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
