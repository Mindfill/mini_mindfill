import { ReactNode } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";

interface AuthLayoutProps {
    /** Form content — rendered inside the glass card, below the headline. */
    children: ReactNode;
    /** Headline block (usually an <h1>), rendered above children in the card. */
    headline: ReactNode;
    /** Changes when switching sign-in/sign-up/forgot — refires the card's fade. */
    transitionKey?: string;
}

/**
 * Shared chrome for /login and /reset-password: split-screen on desktop (form
 * left, animated abstract panel right), single column with a gradient wash on
 * mobile. Auth logic/state stays in each page — this only owns layout/style.
 */
export default function AuthLayout({ children, headline, transitionKey }: AuthLayoutProps) {
    return (
        <div className="h-[100dvh] w-full flex flex-col bg-background text-foreground overflow-hidden relative isolate">
            {/* Fixed to the viewport, not the scrolling section below — so it
                always covers the full screen no matter how much the section's
                content scrolls, instead of being sized to the section's own
                (potentially content-stretched) box and getting "cut off". */}
            <div className="fixed inset-0 -z-10 bg-brand-gradient opacity-70 pointer-events-none" />

            <section className="flex-1 min-h-0 flex flex-col relative overflow-y-auto">
                <header className="p-4 sm:p-6 relative z-10 flex-shrink-0">
                    <Link href="/">
                        <div className="flex items-center gap-3 cursor-pointer group w-fit">
                            <img
                                src="/images/mindfill.png"
                                alt="TECHCESS Logo"
                                className="w-9 h-9 sm:w-10 sm:h-10 object-contain transition-transform group-hover:scale-110 duration-500"
                            />
                            <h1
                                className="font-display text-lg sm:text-xl font-bold tracking-tight text-foreground"
                                data-testid="logo-techcess"
                            >
                                TECHCESS
                            </h1>
                        </div>
                    </Link>
                </header>

                <main className="flex-1 flex items-center justify-center relative z-10 px-4 sm:px-6 py-4">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={transitionKey}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -14 }}
                            transition={{ duration: 0.35, ease: "easeOut" }}
                            className="relative w-full max-w-md text-center my-auto"
                        >
                            <div className="rounded-[2rem] border border-border/40 bg-card/30 backdrop-blur-2xl shadow-[0_0_70px_-20px_hsl(var(--primary)/0.45)] p-6 sm:p-8 md:p-10">
                                {headline}
                                {children}
                            </div>
                        </motion.div>
                    </AnimatePresence>
                </main>

                <footer className="flex-shrink-0 py-3 px-6 text-center relative z-10">
                    <p className="text-[10px] sm:text-xs text-muted-foreground">© 2026 TECHCESS. All rights reserved.</p>
                </footer>
            </section>
        </div>
    );
}
