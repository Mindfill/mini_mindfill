import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import ReactMarkdown from "react-markdown";
import { ArrowLeft } from "lucide-react";

interface LegalPageProps {
    title: string;
    markdown: string;
}

/** Renders a Markdown legal document (privacy policy / terms) as a page. */
export default function LegalPage({ title, markdown }: LegalPageProps) {
    const [, navigate] = useLocation();

    useEffect(() => {
        document.title = `${title} | TECHCESS`;
        window.scrollTo(0, 0);
    }, [title]);

    return (
        <div className="min-h-[100dvh] bg-black text-white flex flex-col">
            <header className="p-5 sm:p-8 flex-shrink-0">
                <Link href="/">
                    <div className="flex items-center gap-3 cursor-pointer group w-fit">
                        <img
                            src="/images/mindfill.png"
                            alt="TECHCESS Logo"
                            className="w-9 h-9 object-contain transition-transform group-hover:scale-110 duration-500"
                        />
                        <span className="text-lg font-bold tracking-tight text-white">TECHCESS</span>
                    </div>
                </Link>
            </header>

            <main className="flex-1 w-full max-w-3xl mx-auto px-5 sm:px-8 pb-16">
                <button
                    onClick={() => navigate("/")}
                    className="text-white/40 hover:text-white text-xs font-bold tracking-widest uppercase flex items-center gap-1 mb-8 transition-colors"
                >
                    <ArrowLeft className="w-3 h-3" /> Back to home
                </button>

                <article
                    className="prose prose-invert prose-sm sm:prose-base max-w-none
                        prose-headings:font-bold prose-headings:text-white
                        prose-h1:text-3xl prose-h1:mb-2
                        prose-a:text-primary hover:prose-a:text-primary/80
                        prose-strong:text-white prose-li:marker:text-white/30
                        prose-p:text-white/70 prose-li:text-white/70"
                >
                    <ReactMarkdown>{markdown}</ReactMarkdown>
                </article>
            </main>
        </div>
    );
}
