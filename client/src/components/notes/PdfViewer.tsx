import { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { Loader2, X } from "lucide-react";

// pdf.js needs its worker; Vite's ?url import gives a bundled URL.
pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

interface PdfViewerProps {
    url: string;
}

/**
 * Renders a PDF with pdf.js by drawing each page to a <canvas>, so it works on
 * mobile browsers that won't embed PDFs in an <iframe>. Pages are rendered
 * sequentially and appended imperatively (React never owns the canvases), which
 * avoids reconciliation races and reliably paints every page.
 */
export default function PdfViewer({ url }: PdfViewerProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [progress, setProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

    useEffect(() => {
        let cancelled = false;
        const container = containerRef.current;

        setLoading(true);
        setError(null);
        setProgress({ done: 0, total: 0 });
        if (container) container.innerHTML = "";

        const task = pdfjsLib.getDocument({ url });

        (async () => {
            let pdf: Awaited<typeof task.promise> | null = null;
            try {
                pdf = await task.promise;
                if (cancelled) return;

                setLoading(false);
                setProgress({ done: 0, total: pdf.numPages });

                // Target render width: container width, capped so desktop pages
                // aren't gigantic. DevicePixelRatio keeps it crisp.
                const cssWidth = Math.min((container?.clientWidth || 800) - 16, 900);
                const dpr = window.devicePixelRatio || 1;

                for (let n = 1; n <= pdf.numPages; n++) {
                    if (cancelled) break;
                    const page = await pdf.getPage(n);
                    const base = page.getViewport({ scale: 1 });
                    const viewport = page.getViewport({ scale: (cssWidth / base.width) * dpr });

                    const canvas = document.createElement("canvas");
                    canvas.width = Math.floor(viewport.width);
                    canvas.height = Math.floor(viewport.height);
                    canvas.style.width = "100%";
                    canvas.style.maxWidth = `${cssWidth}px`;
                    canvas.style.height = "auto";
                    canvas.className = "bg-white shadow-lg rounded-sm block";

                    const ctx = canvas.getContext("2d");
                    if (!ctx) continue;

                    if (cancelled) break;
                    container?.appendChild(canvas);
                    await page.render({ canvasContext: ctx, viewport }).promise;
                    if (cancelled) break;
                    setProgress({ done: n, total: pdf.numPages });
                }
            } catch (err) {
                if (!cancelled) {
                    console.error("Failed to render PDF:", err);
                    setError("Could not render this PDF in the app.");
                    setLoading(false);
                }
            }
        })();

        return () => {
            cancelled = true;
            task.destroy().catch(() => {});
            if (container) container.innerHTML = "";
        };
    }, [url]);

    return (
        <div className="w-full h-full relative">
            {loading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 pointer-events-none">
                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground">Loading PDF…</p>
                </div>
            )}

            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
                    <div className="w-14 h-14 rounded-2xl bg-red-500/10 flex items-center justify-center">
                        <X className="w-7 h-7 text-red-500" />
                    </div>
                    <p className="text-muted-foreground max-w-sm">{error}</p>
                    <a href={url} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline text-sm font-medium">
                        Open in a new tab instead
                    </a>
                </div>
            )}

            {/* Rendering progress (first page onward) */}
            {!loading && !error && progress.done < progress.total && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 bg-card/90 border border-border rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground shadow">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Rendering {progress.done}/{progress.total}
                </div>
            )}

            {/* pdf.js draws canvases into this container imperatively */}
            <div
                ref={containerRef}
                className="w-full h-full overflow-y-auto flex flex-col items-center gap-4 py-4 px-2"
            />
        </div>
    );
}
