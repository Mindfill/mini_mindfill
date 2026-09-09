import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";
import { supabase } from "@/lib/supabase";
import { Input } from "@/components/ui/input";
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
        } catch (err: any) {
            setError(err?.message || "Something went wrong. Please try again.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-[100dvh] text-white flex flex-col bg-black">
            <header className="p-5 sm:p-8 z-50 flex-shrink-0">
                <Link href="/">
                    <div className="flex items-center gap-3 cursor-pointer group w-fit">
                        <img
                            src="/images/mindfill.png"
                            alt="TECHCESS Logo"
                            className="w-9 h-9 sm:w-10 sm:h-10 object-contain transition-transform group-hover:scale-110 duration-500"
                        />
                        <h1
                            className="text-lg sm:text-xl font-bold tracking-tight text-white"
                            data-testid="logo-techcess"
                        >
                            TECHCESS
                        </h1>
                    </div>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center relative overflow-y-auto px-4 sm:px-6 py-6">
                {/* Radial glow background */}
                <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        background:
                            "radial-gradient(circle at center, rgba(71, 100, 120, 0.1) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 w-full max-w-md text-center my-auto">
                    <div className="rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl p-7 sm:p-10 md:p-12">
                        <h1
                            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-8 md:mb-10 tracking-tight leading-tight text-white"
                            data-testid="text-login-headline"
                        >
                            Become <br />
                            <span className="text-white/20">the Exception.</span>
                        </h1>

                        <div className="flex justify-center mb-6">
                            <GoogleSignInButton />
                        </div>

                        <div className="flex items-center gap-3 my-6 text-white/30 text-xs uppercase tracking-wider">
                            <div className="flex-1 h-px bg-white/10" />
                            or
                            <div className="flex-1 h-px bg-white/10" />
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-4 text-left">
                            <div className="space-y-1.5">
                                <Label htmlFor="email" className="text-white/70">
                                    Email
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white"
                                    disabled={submitting}
                                />
                            </div>

                            {mode !== "forgot" && (
                                <div className="space-y-1.5">
                                    <Label htmlFor="password" className="text-white/70">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white"
                                        disabled={submitting}
                                    />
                                </div>
                            )}

                            {error && <p className="text-sm text-red-400">{error}</p>}
                            {checkEmailMessage && <p className="text-sm text-green-400">{checkEmailMessage}</p>}

                            <Button type="submit" disabled={submitting} className="w-full gap-2">
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                {mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in"}
                            </Button>
                        </form>

                        <div className="mt-5 text-sm text-white/40 space-y-1.5">
                            {mode === "signin" && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setMode("forgot");
                                            setError(null);
                                            setCheckEmailMessage(null);
                                        }}
                                        className="block w-full hover:text-white/70 transition-colors"
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
                                        className="block w-full hover:text-white/70 transition-colors"
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
                                    className="block w-full hover:text-white/70 transition-colors"
                                >
                                    Back to sign in
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 py-5 px-6 text-center">
                <p className="text-[10px] sm:text-xs text-white/20">© 2026 TECHCESS. All rights reserved.</p>
            </footer>
        </div>
    );
}
