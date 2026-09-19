import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchVisualizationsStatus, extractStreamingContent, type NoteFigure, type VizStatus } from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import type { KeyTerm } from "@/lib/keywordHighlight";
import { Loader2, RefreshCw } from "lucide-react";

const POLL_MS = 5000;
const SLOW_POLL_MS = 15000; // after SLOW_AFTER_MS a render is in the backend's retry cycle — poll less often
const SLOW_AFTER_MS = 2 * 60 * 1000;
const MAX_RETRIES = 2; // matches the backend retry job
// The backend creates a visual's row before the reply finishes streaming, so
// a row that's still missing after a few polls will never exist (an old
// message from before server-side numbering, or a failed reservation).
const MAX_MISSING_POLLS = 4;

/**
 * Safety net: if a message's content is actually the raw JSON envelope
 * ({"content":"…","layer":…}) — e.g. a stream that didn't parse cleanly, or a
 * fallback that stored the raw string — unwrap the content field so we never
 * show raw JSON and the [VIZ:N] tokens inside it still get parsed.
 */
function normalizeContent(raw: string): string {
    const t = raw.trimStart();
    if (!t.startsWith("{")) return raw;
    try {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === "object" && typeof (obj as { content?: unknown }).content === "string") {
            return (obj as { content: string }).content;
        }
        return raw;
    } catch {
        if (t.includes('"content"')) {
            const extracted = extractStreamingContent(raw);
            if (extracted) return extracted;
        }
        return raw;
    }
}

interface ChatContentProps {
    content: string;
    /** Session the message belongs to — needed to pull its [VIZ:N] videos. */
    sessionId?: string;
    /** Kept for API compatibility; the viz container polls the same way regardless. */
    isHistory?: boolean;
    className?: string;
    /** Feature 05 — omit for the live-streaming bubble; only committed messages get highlighted. */
    keyTerms?: KeyTerm[];
    /** §2.3 — the note's own figures by number, for [FIGURE:n] tokens (notes chat only). */
    figures?: Record<number, NoteFigure>;
}

type Segment =
    | { type: "text"; text: string }
    | { type: "viz"; index: number }
    | { type: "figure"; number: number };

const TOKEN_RE = /\[(VIZ|FIGURE):(\d+)\]/g;

function parseSegments(content: string): Segment[] {
    const segs: Segment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(content)) !== null) {
        if (m.index > last) segs.push({ type: "text", text: content.slice(last, m.index) });
        const n = parseInt(m[2], 10);
        segs.push(m[1] === "VIZ" ? { type: "viz", index: n } : { type: "figure", number: n });
        last = m.index + m[0].length;
    }
    if (last < content.length) segs.push({ type: "text", text: content.slice(last) });
    return segs;
}

const isReady = (s?: VizStatus) =>
    (s?.render_status === "complete" || s?.render_status === "success") && !!s?.video_url;
const isPermanentFail = (s?: VizStatus) =>
    s?.render_status === "failed" && (s.retry_count ?? 0) >= MAX_RETRIES;
const isTerminal = (s?: VizStatus) => isReady(s) || isPermanentFail(s);

/**
 * Renders a chat message: teaching text with inline [VIZ:N] tokens replaced by a
 * persistent, always-present visual container. The container actively polls
 * /visualizations/status (every 5s while in view) and reflects the render state:
 * loading → retrying → video, or a permanent-failure state.
 */
export default function ChatContent({ content, sessionId, className, keyTerms, figures }: ChatContentProps) {
    const segments = useMemo(() => parseSegments(normalizeContent(content)), [content]);

    return (
        <div className={className}>
            {segments.map((seg, i) => {
                if (seg.type === "text") {
                    return seg.text.trim() ? <MarkdownLatex key={i} content={seg.text} keyTerms={keyTerms} /> : null;
                }
                if (seg.type === "viz") {
                    return <VizSlot key={i} index={seg.index} sessionId={sessionId} />;
                }
                // Unknown number (or figures not loaded yet) → nothing, never a broken image.
                const figure = figures?.[seg.number];
                return figure ? <FigureSlot key={i} figure={figure} /> : null;
            })}
        </div>
    );
}

/** One of the student's own figures, inline. Tap to see it full size —
 * textbook diagrams carry small labels a chat-width image can't show. */
function FigureSlot({ figure }: { figure: NoteFigure }) {
    const [open, setOpen] = useState(false);
    const name = figure.label || `Figure ${figure.number}`;
    const alt = figure.description ? `${name}: ${figure.description}` : name;

    return (
        <figure className="my-4">
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={`Enlarge ${name}`}
                // White ground: textbook figures are drawn for paper, and many
                // PNGs are transparent — on a dark card their black lines vanish.
                className="block w-full rounded-2xl overflow-hidden border border-border bg-white cursor-zoom-in focus-visible:ring-2 focus-visible:ring-primary outline-none"
            >
                <img src={figure.url} alt={alt} loading="lazy" className="w-full max-h-[420px] object-contain" />
            </button>
            <figcaption className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground/80">{name}</span> · from your notes, page {figure.page}
            </figcaption>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-w-4xl w-[calc(100vw-2rem)] p-3">
                    <DialogTitle className="text-sm font-semibold pr-8">{name}</DialogTitle>
                    <div className="rounded-xl overflow-hidden bg-white">
                        <img src={figure.url} alt={alt} className="w-full h-auto max-h-[80dvh] object-contain" />
                    </div>
                </DialogContent>
            </Dialog>
        </figure>
    );
}

function VizSlot({ index, sessionId }: { index: number; sessionId?: string }) {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";
    const ref = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<VizStatus | undefined>(undefined);
    const [missing, setMissing] = useState(false);
    const [inView, setInView] = useState(false);

    const statusRef = useRef<VizStatus | undefined>(undefined);
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Lazy: only load/poll when the container is (near) in view.
    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const io = new IntersectionObserver(
            (entries) => setInView(entries.some((e) => e.isIntersecting)),
            { rootMargin: "300px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, []);

    // Actively pull status from the DB every 5s while in view, until terminal.
    useEffect(() => {
        if (!sessionId || !accessToken || !inView || missing || isTerminal(statusRef.current)) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        let missingPolls = 0;
        const startedAt = Date.now();

        const tick = async () => {
            try {
                const list = await fetchVisualizationsStatus(sessionId, accessToken, index);
                if (cancelled) return;
                // Exact index only. Never fall back to another row — that
                // showed an earlier visual in place of a new one.
                const found = list.find((v) => v.viz_index === index);
                if (found) {
                    missingPolls = 0;
                    setStatus(found);
                    if (isTerminal(found)) return; // stop polling
                } else if (++missingPolls >= MAX_MISSING_POLLS) {
                    setMissing(true);
                    return;
                }
            } catch {
                // keep polling through transient errors
            }
            if (!cancelled) {
                timer = setTimeout(tick, Date.now() - startedAt > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
            }
        };
        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [sessionId, accessToken, inView, index, missing]);

    // Permanent failure (backend gave up after 2 retries) or a visual that
    // doesn't exist — render no container.
    if (missing || isPermanentFail(status)) return null;

    // Container persists while the visual is loading/retrying or ready.
    return (
        <div ref={ref} className="my-4">
            {isReady(status) ? (
                <VizVideo url={status!.video_url!} />
            ) : status?.render_status === "failed" || (status?.retry_count ?? 0) > 0 ? (
                <VizFrame icon={<RefreshCw className="w-5 h-5 animate-spin" />} label="Retrying visual…" pulse />
            ) : (
                <VizFrame icon={<Loader2 className="w-5 h-5 animate-spin" />} label="Rendering visual…" pulse />
            )}
        </div>
    );
}

/**
 * Visual container shape. Phones get a taller 4:3 box; md and up keep 16:9.
 * The Manim renders are 16:9 on Manim's default black background, so the
 * extra height on a black box reads as part of the scene rather than as bars.
 */
export const VIZ_BOX = "aspect-[4/3] md:aspect-video";

export function VizVideo({ url }: { url: string }) {
    // Auto-play + loop, muted so browsers allow it; no controls (the play button
    // covering the animation is poor UX for short teaching clips).
    //
    // On phones the video is also zoomed 12% so the figure is bigger. That
    // trims ~5% off each side — Manim keeps its scene inside a margin, so the
    // cut falls on empty frame edge, not on labels. Laptops are unchanged.
    return (
        <div className={`rounded-2xl overflow-hidden border border-border bg-black ${VIZ_BOX} w-full`}>
            <video
                src={url}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-contain scale-[1.12] md:scale-100"
            />
        </div>
    );
}

function VizFrame({ icon, label, pulse }: { icon: React.ReactNode; label: string; pulse?: boolean }) {
    return (
        <div
            className={`rounded-2xl border border-border bg-muted/40 ${VIZ_BOX} w-full flex items-center justify-center ${
                pulse ? "animate-pulse" : ""
            }`}
        >
            <div className="flex flex-col items-center gap-2 text-muted-foreground text-center px-4">
                {icon}
                <span className="text-[10px] font-bold tracking-widest uppercase">{label}</span>
            </div>
        </div>
    );
}
