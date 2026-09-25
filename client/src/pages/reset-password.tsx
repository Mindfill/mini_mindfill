import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authErrors";
import AuthLayout from "@/components/auth/AuthLayout";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Landing page for the link in the password-reset email. Supabase detects
 * the recovery token in the URL and establishes a session automatically —
 * this page just collects the new password.
 */
export default function ResetPassword() {
    const { session, isLoading } = useAuth();
    const [, navigate] = useLocation();

    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState(false);

    const [linkError, setLinkError] = useState<string | null>(null);

    useEffect(() => {
        document.title = "Reset password | TECHCESS";

        // When a recovery link is expired, already used, or points at a
        // redirect URL that isn't on Supabase's allow-list, Supabase sends the
        // reason back on the URL rather than issuing a session. We were
        // dropping it and showing a generic "invalid or expired", which hid
        // the one piece of information that says which of those it was.
        const fromHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const fromQuery = new URLSearchParams(window.location.search);
        const description =
            fromHash.get("error_description") ?? fromQuery.get("error_description");
        const code = fromHash.get("error") ?? fromQuery.get("error");

        if (description || code) {
            console.error("Password recovery link rejected:", { code, description });
            setLinkError(description?.replace(/\+/g, " ") ?? code);
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setSubmitting(true);
        try {
            const { error: updateError } = await supabase.auth.updateUser({ password });
            if (updateError) throw updateError;
            setDone(true);
            setTimeout(() => navigate("/dashboard"), 1500);
        } catch (err: unknown) {
            setError(authErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            headline={
                <h1 className="font-display text-2xl sm:text-3xl font-bold mb-8 tracking-tight leading-tight text-foreground">
                    Set a new password
                </h1>
            }
        >
            {isLoading ? (
                <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />
            ) : !session ? (
                <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                        This reset link is invalid or has expired.{" "}
                        <Link href="/login" className="underline hover:text-foreground">
                            Request a new one
                        </Link>
                        .
                    </p>
                    {linkError && <p className="text-xs text-destructive">{linkError}</p>}
                </div>
            ) : done ? (
                <p className="text-sm text-green-700 dark:text-green-400">Password updated — taking you to your dashboard.</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div className="space-y-1.5">
                        <Label htmlFor="new-password" className="text-muted-foreground">
                            New password
                        </Label>
                        <PasswordInput
                            id="new-password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-background/50 border-border/60"
                            disabled={submitting}
                        />
                    </div>

                    {error && <p className="text-sm text-destructive">{error}</p>}

                    <Button type="submit" size="lg" disabled={submitting} className="w-full gap-2">
                        {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Update password
                    </Button>
                </form>
            )}
        </AuthLayout>
    );
}
