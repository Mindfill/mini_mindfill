import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { acceptSubscriptionInvite } from "@/lib/api";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PENDING_INVITE_TOKEN_KEY } from "@/lib/pendingInvite";

type Status = "checking" | "accepted" | "error";

export default function InviteAccept() {
    const { session, isLoading: authLoading } = useAuth();
    const [, navigate] = useLocation();
    const [status, setStatus] = useState<Status>("checking");
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    useEffect(() => {
        document.title = "Accept invite | TECHCESS";
    }, []);

    useEffect(() => {
        if (authLoading) return;

        const token = new URLSearchParams(window.location.search).get("token");
        if (!token) {
            setStatus("error");
            setErrorMessage("This invite link is missing its token.");
            return;
        }

        if (!session) {
            // Not logged in yet — stash the token and send them to log in first;
            // use-auth.tsx picks this up on SIGNED_IN and finishes the accept.
            localStorage.setItem(PENDING_INVITE_TOKEN_KEY, token);
            navigate("/login");
            return;
        }

        acceptSubscriptionInvite(token, session.access_token)
            .then(() => {
                localStorage.removeItem(PENDING_INVITE_TOKEN_KEY);
                setStatus("accepted");
                setTimeout(() => navigate("/dashboard"), 1500);
            })
            .catch((err: Error) => {
                setStatus("error");
                setErrorMessage(err.message || "This invite link is no longer valid.");
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, authLoading]);

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex items-center justify-center p-6">
            <div className="max-w-sm w-full text-center space-y-4">
                {status === "checking" && (
                    <>
                        <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
                        <p className="text-muted-foreground text-sm">Confirming your invite...</p>
                    </>
                )}
                {status === "accepted" && (
                    <>
                        <CheckCircle2 className="w-10 h-10 mx-auto text-green-500" />
                        <h1 className="text-lg font-semibold">You're in</h1>
                        <p className="text-muted-foreground text-sm">Taking you to your dashboard...</p>
                    </>
                )}
                {status === "error" && (
                    <>
                        <XCircle className="w-10 h-10 mx-auto text-destructive" />
                        <h1 className="text-lg font-semibold">Couldn't accept this invite</h1>
                        <p className="text-muted-foreground text-sm">{errorMessage}</p>
                        <Button onClick={() => navigate("/dashboard")}>Go to dashboard</Button>
                    </>
                )}
            </div>
        </div>
    );
}
