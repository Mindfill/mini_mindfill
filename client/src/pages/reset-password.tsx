import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import AuthLayout from "@/components/auth/AuthLayout";
import { Input } from "@/components/ui/input";
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

    useEffect(() => {
        document.title = "Reset password | TECHCESS";
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
        } catch (err: any) {
            setError(err?.message || "Something went wrong. Please try again.");
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
                <p className="text-sm text-muted-foreground">
                    This reset link is invalid or has expired.{" "}
                    <Link href="/login" className="underline hover:text-foreground">
                        Request a new one
                    </Link>
                    .
                </p>
            ) : done ? (
                <p className="text-sm text-green-700 dark:text-green-400">Password updated — taking you to your dashboard.</p>
            ) : (
                <form onSubmit={handleSubmit} className="space-y-4 text-left">
                    <div className="space-y-1.5">
                        <Label htmlFor="new-password" className="text-muted-foreground">
                            New password
                        </Label>
                        <Input
                            id="new-password"
                            type="password"
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
