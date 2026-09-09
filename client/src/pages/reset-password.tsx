import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
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
        <div className="min-h-[100dvh] text-white flex flex-col bg-black">
            <header className="p-5 sm:p-8 z-50 flex-shrink-0">
                <Link href="/">
                    <div className="flex items-center gap-3 cursor-pointer group w-fit">
                        <img
                            src="/images/mindfill.png"
                            alt="TECHCESS Logo"
                            className="w-9 h-9 sm:w-10 sm:h-10 object-contain transition-transform group-hover:scale-110 duration-500"
                        />
                        <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white">TECHCESS</h1>
                    </div>
                </Link>
            </header>

            <main className="flex-1 flex items-center justify-center relative overflow-y-auto px-4 sm:px-6 py-6">
                <div
                    className="absolute inset-0 opacity-20 pointer-events-none"
                    style={{
                        background:
                            "radial-gradient(circle at center, rgba(71, 100, 120, 0.1) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 w-full max-w-md text-center my-auto">
                    <div className="rounded-3xl border border-white/5 bg-black/40 backdrop-blur-xl p-7 sm:p-10 md:p-12">
                        <h1 className="text-2xl sm:text-3xl font-bold mb-8 tracking-tight leading-tight text-white">
                            Set a new password
                        </h1>

                        {isLoading ? (
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-white/40" />
                        ) : !session ? (
                            <p className="text-sm text-white/50">
                                This reset link is invalid or has expired.{" "}
                                <Link href="/login" className="underline hover:text-white/80">
                                    Request a new one
                                </Link>
                                .
                            </p>
                        ) : done ? (
                            <p className="text-sm text-green-400">Password updated — taking you to your dashboard.</p>
                        ) : (
                            <form onSubmit={handleSubmit} className="space-y-4 text-left">
                                <div className="space-y-1.5">
                                    <Label htmlFor="new-password" className="text-white/70">
                                        New password
                                    </Label>
                                    <Input
                                        id="new-password"
                                        type="password"
                                        required
                                        minLength={6}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-white/5 border-white/10 text-white"
                                        disabled={submitting}
                                    />
                                </div>

                                {error && <p className="text-sm text-red-400">{error}</p>}

                                <Button type="submit" disabled={submitting} className="w-full gap-2">
                                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Update password
                                </Button>
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <footer className="flex-shrink-0 py-5 px-6 text-center">
                <p className="text-[10px] sm:text-xs text-white/20">© 2026 TECHCESS. All rights reserved.</p>
            </footer>
        </div>
    );
}
