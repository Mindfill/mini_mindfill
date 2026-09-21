/**
 * The dyslexia-friendly font preference (OpenDyslexic), applied by adding a
 * `dyslexic` class to <html> — see the `html.dyslexic` rule in index.css.
 *
 * Two places remember it, deliberately:
 *   - localStorage, read in main.tsx before first paint so there's no flash of
 *     the standard font, and so the sidebar toggle works offline
 *   - user_profiles.has_dyslexia, set during onboarding, so the preference
 *     follows the account onto a phone or a school computer rather than living
 *     in one browser
 *
 * The server value wins on load; the toggle updates the local one.
 */
export const DYSLEXIA_STORAGE_KEY = "dyslexia-font";

export function applyDyslexiaFont(enabled: boolean): void {
    document.documentElement.classList.toggle("dyslexic", enabled);
    try {
        localStorage.setItem(DYSLEXIA_STORAGE_KEY, enabled ? "1" : "0");
    } catch {
        /* localStorage unavailable (private mode, blocked site data) */
    }
}

export function isDyslexiaFontOn(): boolean {
    return document.documentElement.classList.contains("dyslexic");
}
