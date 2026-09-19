/**
 * Cached reads for the secondary lesson flow (react-query).
 *
 * Why: every page used to fetch in a useEffect into local state, so leaving a
 * page threw its data away — coming back (or pressing Back) always meant a
 * blank loading state and a fresh 1–3s round trip. Cached queries render the
 * last known data instantly and revalidate in the background.
 *
 * Keys never include the access token: a token refresh must not look like
 * different data (that would refetch and flash every page hourly).
 */
import { useQuery, type QueryClient } from "@tanstack/react-query";
import {
    fetchChapters,
    fetchChapterToc,
    fetchSubjects,
    fetchSubsection,
    type ClassLevel,
} from "./secondaryApi";

export const secondaryKeys = {
    all: ["secondary"] as const,
    // Prefix ["secondary", "subjects"] still matches every class's list for invalidation.
    subjects: (classLevel?: string | null) => ["secondary", "subjects", classLevel ?? "own"] as const,
    chapters: (subjectId: string) => ["secondary", "chapters", subjectId] as const,
    toc: (chapterId: string) => ["secondary", "toc", chapterId] as const,
    subsection: (subsectionId: string) => ["secondary", "subsection", subsectionId] as const,
    dashboard: () => ["secondary", "dashboard"] as const,
};

// Navigation data shows cached immediately and refreshes behind the scenes.
const NAV_OPTIONS = {
    staleTime: 30_000,
    gcTime: 30 * 60_000,
    refetchOnMount: "always" as const,
    retry: 1,
};

/** `classLevel` null = the student's own class (the server decides). */
export const useSubjects = (token: string, classLevel?: ClassLevel | null) =>
    useQuery({
        queryKey: secondaryKeys.subjects(classLevel),
        queryFn: () => fetchSubjects(token, classLevel),
        ...NAV_OPTIONS,
        // Switching class tabs keeps the last list on screen (dimmed) rather
        // than flashing the skeleton.
        placeholderData: (previous) => previous,
    });

export const useChapters = (subjectId: string, token: string) =>
    useQuery({ queryKey: secondaryKeys.chapters(subjectId), queryFn: () => fetchChapters(subjectId, token), ...NAV_OPTIONS });

export const useChapterToc = (chapterId: string, token: string) =>
    useQuery({ queryKey: secondaryKeys.toc(chapterId), queryFn: () => fetchChapterToc(chapterId, token), ...NAV_OPTIONS });

export const useSubsection = (subsectionId: string, token: string) =>
    useQuery({
        queryKey: secondaryKeys.subsection(subsectionId),
        queryFn: () => fetchSubsection(subsectionId, token),
        ...NAV_OPTIONS,
        // 402/403/404 are answers, not blips — retrying just delays the message.
        retry: (count: number, err: unknown) => count < 1 && !(err instanceof Error && "status" in err && [402, 403, 404].includes((err as { status: number }).status)),
    });

/** After progress changes, every listing that shows progress is out of date. */
export function invalidateSecondaryProgress(client: QueryClient) {
    return client.invalidateQueries({ queryKey: secondaryKeys.all });
}
