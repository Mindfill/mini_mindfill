import { useEffect, useRef, useState } from "react";
import { useLocation, useParams } from "wouter";
import { Loader2, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { redeemDemoLink } from "@/lib/api";
import { clearDeviceToken, getDeviceToken } from "@/lib/device";

const ERRORS: Record<string, string> = {
    demo_link_invalid: "This demo link isn't valid. Check you copied all of it.",
    demo_link_expired: "This demo link has expired.",
    demo_link_revoked: "This demo link has been switched off.",
};

/** The device token arrives from use-auth's SIGNED_IN handler. Secondary
 * pages need it on their first request, so give it a moment — but never
 * strand the investor here if registration is slow. */
async function waitForDeviceToken(timeoutMs: number): Promise<void> {
    const start = Date.now();
    while (!getDeviceToken() && Date.now() - start < timeoutMs) {
        await new Promise((r) => setTimeout(r, 200));
    }
}

/**
 * /demo/:token — an investor's one-click way in. The backend turns the link
 * into a one-time sign-in token for that link's demo account; verifyOtp
 * exchanges it for a session here, and use-auth registers the device exactly
 * as it would for a normal login.
 */
export default function DemoEntry() {
    const { token } = useParams<{ token: string }>();
    const [, navigate] = useLocation();
    const [error, setError] = useState<string | null>(null);
    const started = useRef(false);

    useEffect(() => {
        document.title = "Techcess demo | TECHCESS";
    }, []);

    useEffect(() => {
        // StrictMode mounts twice; a second redeem would mint a second sign-in.
        if (started.current) return;
        started.current = true;

        (async () => {
            try {
                const { token_hash } = await redeemDemoLink(token);
                // Whoever was signed in on this browser before, the demo
                // account replaces them. Signing out first also resets
                // use-auth's per-user guard, so device registration runs even
                // when it's the same demo account coming back.
                await supabase.auth.signOut({ scope: "local" });
                clearDeviceToken();
                const { error: otpError } = await supabase.auth.verifyOtp({ token_hash, type: "magiclink" });
                if (otpError) throw otpError;
                await waitForDeviceToken(8000);
                navigate("/secondary/dashboard", { replace: true });
            } catch (err) {
                console.error("[demo] Could not open demo:", err);
                const code = err instanceof Error ? err.message : "";
                setError(ERRORS[code] ?? "Something went wrong opening the demo. Please try the link again.");
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (!error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col items-center justify-center gap-4 p-6">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <p className="text-muted-foreground text-sm">Setting up your demo…</p>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex items-center justify-center p-6">
            <div className="max-w-sm w-full text-center space-y-4">
                <XCircle className="w-10 h-10 mx-auto text-destructive" />
                <h1 className="text-lg font-semibold">Couldn't open the demo</h1>
                <p className="text-muted-foreground text-sm">{error}</p>
                <p className="text-muted-foreground text-sm">
                    Need a new link? Write to{" "}
                    <a href="mailto:support@techcess.org" className="text-primary underline">support@techcess.org</a>.
                </p>
            </div>
        </div>
    );
}
