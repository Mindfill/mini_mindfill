import type { ComponentType } from "react";

/**
 * Keeps moving around the university app (sidebar tabs, opening a lesson or a
 * note) from blanking the screen.
 *
 * Each of those pages is its own lazy route, so the first visit to one waits
 * on a chunk download, and App's Suspense fallback used to be the full-screen
 * loader, with no sidebar. Two fixes live here:
 *
 * 1. `warmAppRoutes()` downloads those chunks in the background once a
 *    signed-in page has mounted, so most tab switches never suspend.
 * 2. While one still does, App's fallback asks `getShellLoader()` for the
 *    sidebar + mascot loader frame. That component is loaded by the same warm
 *    call (it would bloat the landing-page bundle if App imported it
 *    directly), and until it has loaded the fallback stays the mascot loader.
 *
 * This module is imported by App, so it must stay tiny: dynamic imports only.
 */

export type ShellView = "home" | "courses" | "notes" | "profile" | "lesson" | "note-lesson" | "note";

/** Which page a path is, for the loading frame shown while its chunk downloads, or null for pages
 *  outside the signed-in app (landing, login, onboarding...). */
export function shellViewFor(path: string): ShellView | null {
    if (path === "/dashboard") return "home";
    if (path === "/courses") return "courses";
    if (path === "/notes") return "notes";
    if (path === "/profile") return "profile";
    if (path.startsWith("/lessons/")) return "lesson";
    if (/^\/notes\/[^/]+\/sections\//.test(path)) return "note-lesson";
    if (path.startsWith("/notes/")) return "note";
    return null;
}

let ShellLoader: ComponentType<{ view: ShellView }> | null = null;

export function getShellLoader() {
    return ShellLoader;
}

let warmed = false;

/** `universityTabs`: only university accounts have Courses/Notes, so other
 * accounts skip those downloads. */
export function warmAppRoutes({ universityTabs }: { universityTabs: boolean }) {
    if (warmed || typeof window === "undefined") return;
    warmed = true;
    // Respect data-saver: these are nice-to-have downloads, not needed ones.
    const connection = (navigator as any).connection;
    const saveData = connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType ?? "");

    const idle = (cb: () => void) =>
        "requestIdleCallback" in window ? (window as any).requestIdleCallback(cb) : setTimeout(cb, 300);

    idle(() => {
        import("@/components/brand/AppShellLoader").then((m) => {
            ShellLoader = m.default;
        });
        if (saveData) return;
        import("@/pages/profile");
        if (!universityTabs) return;
        import("@/pages/dashboard");
        import("@/pages/courses");
        import("@/pages/notes");
        // "Resume lesson" is the dashboard's main button.
        import("@/pages/lesson-chat");
        import("@/pages/note-board");
        import("@/pages/note-lesson");
    });
}
