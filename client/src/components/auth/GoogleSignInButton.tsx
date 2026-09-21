import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Google sign-in via Google Identity Services (GIS). GIS obtains an ID token
 * client-side and we exchange it with Supabase via signInWithIdToken — so the
 * OAuth consent screen no longer redirects through (or shows) the Supabase URL.
 * Requires the GIS script (in index.html) and VITE_GOOGLE_CLIENT_ID.
 */

// GIS `initialize()` is global and warns if called more than once. Guard it so
// StrictMode's double-mounted effect (and any remount) only initializes once.
let gisInitialized = false;

async function handleGoogleSignIn(response: { credential: string }) {
    const { error } = await supabase.auth.signInWithIdToken({
        provider: "google",
        token: response.credential,
    });
    if (error) {
        console.error("Sign in error:", error.message);
    }
    // On success the auth listener updates the session and the login page
    // redirects to /dashboard.
}

// renderButton only accepts a fixed pixel width — it has no percentage or
// "fill" mode — and silently clamps to this range.
const GIS_MIN_WIDTH = 200;
const GIS_MAX_WIDTH = 400;

export default function GoogleSignInButton() {
    const wrapRef = useRef<HTMLDivElement>(null);
    const btnRef = useRef<HTMLDivElement>(null);
    const renderedWidth = useRef(0);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
        if (!clientId) {
            console.warn("VITE_GOOGLE_CLIENT_ID is not set — Google sign-in disabled.");
            return;
        }

        let cancelled = false;

        // The width used to be hardcoded at 300, so the button sat narrower
        // than the email form beneath it and read as misaligned inside its
        // box — and on a 360px phone a fixed 300 could overflow its container.
        // Measure the wrapper instead and track it.
        const measure = (): number => {
            const w = wrapRef.current?.clientWidth ?? 0;
            if (!w) return 0;
            return Math.round(Math.min(GIS_MAX_WIDTH, Math.max(GIS_MIN_WIDTH, w)));
        };

        const renderAt = (width: number) => {
            const g = (window as any).google;
            if (!g?.accounts?.id || !btnRef.current) return;
            btnRef.current.innerHTML = "";
            g.accounts.id.renderButton(btnRef.current, {
                theme: "outline",
                size: "large",
                shape: "pill",
                text: "signin_with",
                width,
            });
            renderedWidth.current = width;
        };

        const init = () => {
            if (cancelled) return;
            const g = (window as any).google;
            if (!g?.accounts?.id) {
                // GIS script (async) may not be ready yet — retry shortly.
                window.setTimeout(init, 200);
                return;
            }

            // Initialize the GIS client exactly once for the app's lifetime.
            if (!gisInitialized) {
                g.accounts.id.initialize({
                    client_id: clientId,
                    callback: handleGoogleSignIn,
                });
                gisInitialized = true;
            }

            const width = measure();
            if (width) renderAt(width);
        };

        init();

        // renderButton tears down and rebuilds its iframe, so reacting to every
        // sub-pixel resize would flicker. Only re-render on a real change.
        const observer = new ResizeObserver(() => {
            if (cancelled) return;
            const width = measure();
            if (width && Math.abs(width - renderedWidth.current) >= 2) renderAt(width);
        });
        if (wrapRef.current) observer.observe(wrapRef.current);

        return () => {
            cancelled = true;
            observer.disconnect();
        };
    }, []);

    // Wrapper spans the form's width so the button can be measured against it
    // and centred within it; the inner div is what GIS renders into.
    return (
        <div ref={wrapRef} className="w-full flex justify-center">
            <div ref={btnRef} id="google-btn" />
        </div>
    );
}
