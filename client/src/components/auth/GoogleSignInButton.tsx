import { useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";

/**
 * Google sign-in via Google Identity Services (GIS). GIS obtains an ID token
 * client-side and we exchange it with Supabase via signInWithIdToken — so the
 * OAuth consent screen no longer redirects through (or shows) the Supabase URL.
 * Requires the GIS script (in index.html) and VITE_GOOGLE_CLIENT_ID.
 */
export default function GoogleSignInButton() {
    const btnRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
        if (!clientId) {
            console.warn("VITE_GOOGLE_CLIENT_ID is not set — Google sign-in disabled.");
            return;
        }

        let cancelled = false;

        const handleGoogleSignIn = async (response: { credential: string }) => {
            const { error } = await supabase.auth.signInWithIdToken({
                provider: "google",
                token: response.credential,
            });
            if (error) {
                console.error("Sign in error:", error.message);
            }
            // On success the auth listener updates the session and the login
            // page redirects to /dashboard.
        };

        const init = () => {
            if (cancelled) return;
            const g = (window as any).google;
            if (!g?.accounts?.id) {
                // GIS script (async) may not be ready yet — retry shortly.
                window.setTimeout(init, 200);
                return;
            }

            g.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogleSignIn,
            });

            if (btnRef.current) {
                btnRef.current.innerHTML = "";
                g.accounts.id.renderButton(btnRef.current, {
                    theme: "outline",
                    size: "large",
                    shape: "pill",
                    text: "signin_with",
                    width: 300,
                });
            }
        };

        init();
        return () => {
            cancelled = true;
        };
    }, []);

    return <div ref={btnRef} id="google-btn" className="flex justify-center" />;
}
