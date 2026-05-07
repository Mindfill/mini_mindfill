import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "@/lib/supabase";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";

export default function Login() {
    const { session, isLoading } = useAuth();
    const [, navigate] = useLocation();

    useEffect(() => {
        if (!isLoading && session) {
            navigate("/dashboard");
        }
    }, [session, isLoading, navigate]);

    const handleGoogleSignIn = async () => {
        const siteUrl = import.meta.env.VITE_SITE_URL || window.location.origin;
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: `${siteUrl}/dashboard` },
        });
    };

    return (
        <div className="min-h-screen text-white flex flex-col bg-black">
            <header className="absolute top-0 left-0 p-6 z-50">
                <Link href="/">
                    <h1
                        className="text-2xl font-bold tracking-tight cursor-pointer text-gradient"
                        style={{
                            textShadow: "0 0 20px rgba(199, 89, 48, 0.5)"
                        }}
                        data-testid="logo-mindfill"
                    >
                        Mindfill
                    </h1>
                </Link>
            </header>
            <main className="flex-1 flex items-center justify-center relative overflow-hidden px-6">
                {/* Radial glow background */}
                <div
                    className="absolute inset-0 opacity-30"
                    style={{
                        background:
                            "radial-gradient(circle at center, rgba(199, 89, 48, 0.15) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 w-full max-w-md text-center">
                    <div className="rounded-3xl border neon-border bg-black/70 backdrop-blur-md p-10">
                        <h1
                            className="text-3xl md:text-4xl font-bold mb-10 tracking-tight leading-tight text-white"
                            style={{
                                textShadow: "0 0 40px rgba(199, 89, 48, 0.3)",
                            }}
                            data-testid="text-login-headline"
                        >
                            Fill Your Mind.{" "}
                            <span className="text-gradient">
                                Become the Exception.
                            </span>
                        </h1>

                        <Button
                            size="lg"
                            onClick={handleGoogleSignIn}
                            className="w-full bg-white text-black hover:bg-white/90 px-8 py-6 text-base font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-3"
                            style={{
                                boxShadow: "0 0 30px rgba(255, 255, 255, 0.1)",
                            }}
                            data-testid="button-sign-in-google"
                        >
                            <FcGoogle className="w-5 h-5" />
                            Sign In with Google
                        </Button>
                    </div>
                </div>
            </main>

            <Footer />
        </div>
    );
}
