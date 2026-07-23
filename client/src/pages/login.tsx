import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useEffect } from "react";
import GoogleSignInButton from "@/components/auth/GoogleSignInButton";

export default function Login() {
    const { session, isLoading } = useAuth();
    const [, navigate] = useLocation();

    useEffect(() => {
        if (!isLoading && session) {
            navigate("/dashboard");
        }
    }, [session, isLoading, navigate]);

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

                        <div className="flex justify-center">
                            <GoogleSignInButton />
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
