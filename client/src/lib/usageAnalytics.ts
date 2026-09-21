/**
 * Usage analytics — the same payload for the admin, school and parent
 * dashboards, differing only in which students the server let through.
 *
 * Read-only: there is no write path here by design.
 *
 * Figures are secondary-only. The university side has no per-visit session
 * table, so a parent whose children are all at university gets
 * `student_count: 0` with `linked_children > 0` — that pair is how the panel
 * knows to say "not available for university accounts yet" rather than
 * drawing an empty week.
 */
import { BACKEND_URL, authHeaders } from "./api";

export type UsageScope = "admin" | "school" | "parent";

export interface UsageHourBucket {
    /** 0–23, in the student's own clock (Africa/Lagos). */
    hour: number;
    sessions: number;
}

export interface UsageRevisit {
    subsection_id: string;
    subsection_title: string;
    chapter_title: string;
    sessions: number;
    students: number;
}

export interface UsageStudent {
    student_id: string;
    student_name: string;
    class_level: string;
    /** Has logged at least one session outside school hours this week. */
    highly_engaged: boolean;
}

export interface UsageAnalytics {
    week: {
        start: string;
        end: string;
        offset: number;
        label: string;
        is_current: boolean;
    };
    hours: UsageHourBucket[];
    total_sessions: number;
    student_count: number;
    avg_sessions_per_student: number;
    outside_school_hours: { sessions: number; percent: number };
    /** Distinct lessons revisited. `revisits` below is the top few only. */
    revisit_subsection_count: number;
    revisits: UsageRevisit[];
    highly_engaged_student_ids: string[];
    school_hours: { start_hour: number; end_hour: number };
    scope: UsageScope;
    students: UsageStudent[];
    /** Parent scope only — children linked, before the secondary-only filter. */
    linked_children?: number;
}

const PATHS: Record<UsageScope, string> = {
    admin: "/admin/analytics/usage",
    school: "/school/analytics/usage",
    parent: "/parent/analytics/usage",
};

export async function fetchUsageAnalytics(
    scope: UsageScope,
    weekOffset: number,
    accessToken: string,
): Promise<UsageAnalytics> {
    const res = await fetch(`${BACKEND_URL}${PATHS[scope]}?week_offset=${weekOffset}`, {
        headers: authHeaders(accessToken),
    });
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`Failed to fetch usage analytics: ${res.status} — ${text}`);
    }
    return res.json();
}
