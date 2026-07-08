import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { Loader2, X } from "lucide-react";

// pdf.js needs its worker; Vite's ?url import gives a bundled URL.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
    url: string;
}

/**
 * Renders a PDF with pdf.js — pages are drawn to <canvas> so it works on
 * mobile browsers that won't embed PDFs in an <iframe>. Pages render lazily
 * as they scroll into view and scale to the container width.
 */
export default function PdfViewer({ url }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
    const [numPages, setNumPages] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        let cancelled = false;
        setLoading(true);
        setError(null);
        setPdf(null);
        setNumPages(0);

        const task = pdfjsLib.getDocument({ url });
        task.promise
            .then((doc) => {
                if (cancelled) return;
                setPdf(doc);
                setNumPages(doc.numPages);
                setLoading(false);
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("Failed to load PDF:", err);
                setError("Could not render this PDF in the app.");
                setLoading(false);
            });

        return () => {
            cancelled = true;
            task.destroy().catch(() => {});
        };
    }, [url]);

    if (loading) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground">Rendering PDF…</p>
            </div>
        );
    }

    if (error || !pdf) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 p-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                    <X className="w-7 h-7 text-red-500" />
                </div>
                <p className="text-muted-foreground max-w-sm">{error || "This PDF could not be opened."}</p>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline text-sm font-medium"
                >
                    Open in a new tab instead
                </a>
            </div>
        );
    }

    return (
        <div ref={containerRef} className="w-full h-full overflow-y-auto flex flex-col items-center gap-4 py-4 px-2">
            {Array.from({ length: numPages }, (_, i) => (
                <PdfPage key={i} pdf={pdf} pageNumber={i + 1} containerRef={containerRef} />
            ))}
        </div>
    );
}

interface PdfPageProps {
    pdf: PDFDocumentProxy;
    pageNumber: number;
    containerRef: React.RefObject<HTMLDivElement>;
}

function PdfPage({ pdf, pageNumber, containerRef }: PdfPageProps) {
    const wrapRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
    const [visible, setVisible] = useState(false);
    const [rendered, setRendered] = useState(false);

    // Native page size (for the placeholder aspect ratio before render).
    useEffect(() => {
        let cancelled = false;
        pdf.getPage(pageNumber).then((page) => {
            if (cancelled) return;
            const vp = page.getViewport({ scale: 1 });
            setDims({ w: vp.width, h: vp.height });
        });
        return () => {
            cancelled = true;
        };
    }, [pdf, pageNumber]);

    // Render only when scrolled near the viewport.
    useEffect(() => {
        const el = wrapRef.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) setVisible(true);
            },
            { root: containerRef.current, rootMargin: "400px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [containerRef]);

    useEffect(() => {
        if (!visible || rendered || !dims) return;
        let cancelled = false;
        let renderTask: ReturnType<Awaited<ReturnType<PDFDocumentProxy["getPage"]>>["render"]> | null = null;

        (async () => {
            const page = await pdf.getPage(pageNumber);
            const canvas = canvasRef.current;
            const wrap = wrapRef.current;
            if (!canvas || !wrap) return;

            const cssWidth = wrap.clientWidth;
            const base = page.getViewport({ scale: 1 });
            const dpr = window.devicePixelRatio || 1;
            const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            canvas.style.width = "100%";
            canvas.style.height = "auto";

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            renderTask = page.render({ canvasContext: ctx, viewport });
            await renderTask.promise;
            if (!cancelled) setRendered(true);
        })().catch((err) => {
            if (!cancelled && err?.name !== "RenderingCancelledException") {
                console.error(`Failed to render page ${pageNumber}:`, err);
            }
        });

        return () => {
            cancelled = true;
            try {
                renderTask?.cancel();
            } catch {
                /* ignore */
            }
        };
    }, [visible, rendered, dims, pdf, pageNumber]);

    return (
        <div ref={wrapRef} className="w-full max-w-3xl bg-white shadow-lg rounded-sm overflow-hidden">
            {!rendered && (
                <div
                    className="w-full flex items-center justify-center bg-muted/40"
                    style={{ aspectRatio: dims ? `${dims.w} / ${dims.h}` : "1 / 1.414" }}
                >
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
            )}
            <canvas ref={canvasRef} className={rendered ? "block w-full" : "hidden"} />
        </div>
    );
}
