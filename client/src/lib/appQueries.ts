/**
 * Cached reads for the university, parent, school and shared pages — the same
 * treatment the secondary lesson flow gets in lib/secondaryQueries.ts.
 *
 * Before this, each page fetched into local state in a useEffect, so leaving
 * and returning always meant a blank loading state and a fresh round trip.
 * These render the last known data immediately and revalidate behind it.
 *
 * Keys never include the access token: a token refresh must not look like
 * different data, or every page would flash on the hourly refresh.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "./supabase";
import {
    fetchDashboard,
    fetchParentDashboard,
    fetchSchoolDashboard,
    type DashboardResponse,
    type ParentDashboardResponse,
    type SchoolDashboardResponse,
} from "./api";

export const appKeys = {
    uniDashboard: () => ["uni", "dashboard"] as const,
    parentDashboard: () => ["parent", "dashboard"] as const,
    schoolDashboard: () => ["school", "dashboard"] as const,
    courses: () => ["uni", "courses"] as const,
};

/** Shared with secondaryQueries' NAV_OPTIONS: show cached, refresh behind. */
export const CACHED_PAGE = {
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnMount: "always" as const,
    retry: 1,
    retryDelay: 800,
};

export const useUniDashboard = (token: string, enabled = true) =>
    useQuery<DashboardResponse>({
        queryKey: appKeys.uniDashboard(),
        queryFn: () => fetchDashboard(token),
        enabled,
        ...CACHED_PAGE,
    });

export const useParentDashboard = (token: string, enabled = true) =>
    useQuery<ParentDashboardResponse>({
        queryKey: appKeys.parentDashboard(),
        queryFn: () => fetchParentDashboard(token),
        enabled,
        ...CACHED_PAGE,
    });

export const useSchoolDashboard = (token: string, enabled = true) =>
    useQuery<SchoolDashboardResponse>({
        queryKey: appKeys.schoolDashboard(),
        queryFn: () => fetchSchoolDashboard(token),
        enabled,
        ...CACHED_PAGE,
    });

export interface CourseRow { id: string; title: string; slug: string }
export interface ModuleRow { id: string; course_id: string; title: string; slug: string }
export interface LessonRow { id: string; module_id: string; title: string; slug: string }

/** The course catalogue is read straight from Supabase (public content, no
 * backend endpoint) — cached because it's the same list for everyone. */
export const useCourseCatalogue = () =>
    useQuery({
        queryKey: appKeys.courses(),
        queryFn: async () => {
            const [courses, modules, lessons] = await Promise.all([
                supabase.from("courses").select("id, title, slug").order("order_index", { ascending: true }),
                supabase.from("modules").select("id, course_id, title, slug").order("order_index", { ascending: true }),
                supabase.from("lessons").select("id, module_id, title, slug").order("order_index", { ascending: true }),
            ]);
            const failed = courses.error || modules.error || lessons.error;
            if (failed) throw failed;
            return {
                courses: (courses.data || []) as CourseRow[],
                modules: (modules.data || []) as ModuleRow[],
                lessons: (lessons.data || []) as LessonRow[],
            };
        },
        ...CACHED_PAGE,
        // Course content barely changes within a session.
        staleTime: 5 * 60_000,
    });
