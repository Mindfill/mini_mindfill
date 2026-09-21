/**
 * Turns a Supabase auth failure into something a student can act on.
 *
 * supabase-js surfaces a network-level failure as a bare TypeError with the
 * message "Failed to fetch", which we were rendering straight into the form.
 * It tells the user nothing and looks like the app is broken, so map the cases
 * we can recognise and keep the raw error on the console for debugging.
 */
export function authErrorMessage(err: unknown, fallback = "Something went wrong. Please try again."): string {
    if (typeof console !== "undefined") console.error("Auth error:", err);

    const raw = (err as { message?: string } | null)?.message ?? "";
    const message = raw.toLowerCase();

    // TypeError from fetch: DNS, offline, blocked request, or a misconfigured
    // VITE_SUPABASE_URL in the deployed build.
    if (message.includes("failed to fetch") || message.includes("networkerror") || message.includes("load failed")) {
        return "Couldn't reach the authentication service. Check your connection and try again.";
    }

    // Supabase's built-in email sender is rate-limited until custom SMTP is set up.
    if (message.includes("rate limit") || message.includes("too many requests")) {
        return "Too many attempts. Please wait a few minutes and try again.";
    }

    if (message.includes("redirect") && message.includes("not allowed")) {
        return "This link isn't configured correctly. Please contact support.";
    }

    return raw || fallback;
}
