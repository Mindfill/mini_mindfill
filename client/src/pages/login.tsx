import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import AuthLayout from "@/components/auth/AuthLayout";
import { supabase } from "@/lib/supabase";
import { authErrorMessage } from "@/lib/authErrors";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

type Mode = "signin" | "signup" | "forgot";

export default function Login() {
    const { session, isLoading } = useAuth();
    const [, navigate] = useLocation();

    const [mode, setMode] = useState<Mode>("signin");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [checkEmailMessage, setCheckEmailMessage] = useState<string | null>(null);

    useEffect(() => {
        if (!isLoading && session) {
            navigate("/dashboard");
        }
    }, [session, isLoading, navigate]);

    useEffect(() => {
        document.title = "Sign in | TECHCESS";
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setError(null);
        setCheckEmailMessage(null);
        setSubmitting(true);

        try {
            if (mode === "forgot") {
                const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                });
                if (resetError) throw resetError;
                setCheckEmailMessage("Check your email for a link to reset your password.");
            } else if (mode === "signup") {
                const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                if (!data.session) {
                    // Email confirmation is required before a session is issued.
                    setCheckEmailMessage("Check your email to confirm your account, then sign in.");
                }
                // If a session came back immediately (confirmation disabled), the
                // auth listener updates state and the effect above redirects.
            } else {
                const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
                if (signInError) throw signInError;
            }
        } catch (err: unknown) {
            setError(authErrorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthLayout
            transitionKey={mode}
            headline={
                <h1
                    className="font-display text-2xl sm:text-3xl md:text-4xl font-bold mb-8 md:mb-10 tracking-tight leading-tight text-foreground"
                    data-testid="text-login-headline"
                >
                    Become <br />
                    <span className="text-muted-foreground">the Exception.</span>
                </h1>
            }
        >
            <div className="flex justify-center mb-6">
                <GoogleSignInButton />
            </div>

            <div className="flex items-center gap-3 my-6 text-muted-foreground text-xs uppercase tracking-wider">
                <div className="flex-1 h-px bg-border" />
                or
                <div className="flex-1 h-px bg-border" />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-left">
                <div className="space-y-1.5">
                    <Label htmlFor="email" className="text-muted-foreground">
                        Email
                    </Label>
                    <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="bg-background/50 border-border/60"
                        disabled={submitting}
                    />
                </div>

                {mode !== "forgot" && (
                    <div className="space-y-1.5">
                        <Label htmlFor="password" className="text-muted-foreground">
                            Password
                        </Label>
                        <PasswordInput
                            id="password"
                            required
                            minLength={6}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="bg-background/50 border-border/60"
                            disabled={submitting}
                        />
                    </div>
                )}

                {error && <p className="text-sm text-destructive">{error}</p>}
                {checkEmailMessage && <p className="text-sm text-green-700 dark:text-green-400">{checkEmailMessage}</p>}

                <Button type="submit" size="lg" disabled={submitting} className="w-full gap-2">
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                </Button>
            </form>

            <div className="mt-5 text-sm text-muted-foreground space-y-1.5">
                {mode === "signin" && (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setMode("forgot");
                                setError(null);
                                setCheckEmailMessage(null);
                            }}
                            className="block w-full hover:text-foreground transition-colors"
                        >
                            Forgot password?
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setMode("signup");
                                setError(null);
                                setCheckEmailMessage(null);
                            }}
                            className="block w-full hover:text-foreground transition-colors"
                        >
                            Don't have an account? Sign up
                        </button>
                    </>
                )}
                {(mode === "signup" || mode === "forgot") && (
                    <button
                        type="button"
                        onClick={() => {
                            setMode("signin");
                            setError(null);
                            setCheckEmailMessage(null);
                        }}
                        className="block w-full hover:text-foreground transition-colors"
                    >
                        Back to sign in
                    </button>
                )}
            </div>
        </AuthLayout>
    );
}
