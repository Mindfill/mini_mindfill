import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { FcGoogle } from "react-icons/fc";
import { supabase } from "@/lib/supabase";
import { Link } from "wouter";

export default function Login() {
    const handleGoogleSignIn = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "google",
            options: { redirectTo: "http://localhost:5000/dashboard" },
        });
    };

    return (
        <div className="min-h-screen text-stone-900 flex flex-col" style={{ backgroundColor: "#C9C9C5" }}>
            <header className="absolute top-0 left-0 p-6 z-50">
                <Link href="/">
                    <h1
                        className="text-2xl font-bold tracking-tight cursor-pointer"
                        style={{
                            color: "#F59E0B",
                            textShadow: "0 0 20px rgba(245, 158, 11, 0.5)"
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
                            "radial-gradient(circle at center, rgba(245, 158, 11, 0.15) 0%, transparent 70%)",
                    }}
                />

                <div className="relative z-10 w-full max-w-md text-center">
                    <div className="rounded-3xl border border-stone-300 bg-white/70 backdrop-blur-md p-10 shadow-[0_20px_60px_rgba(0,0,0,0.15)]">
                        <h1
                            className="text-3xl md:text-4xl font-bold mb-10 tracking-tight leading-tight text-stone-900"
                            style={{
                                textShadow: "0 0 40px rgba(245, 158, 11, 0.3)",
                            }}
                            data-testid="text-login-headline"
                        >
                            Fill Your Mind.{" "}
                            <span className="text-primary">
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
