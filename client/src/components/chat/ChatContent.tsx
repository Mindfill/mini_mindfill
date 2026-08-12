import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchVisualizationsStatus, extractStreamingContent, type VizStatus } from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { Loader2, RefreshCw, VideoOff } from "lucide-react";

const POLL_MS = 5000; // matches the backend retry interval
const MAX_RETRIES = 2;

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
}

type Segment = { type: "text"; text: string } | { type: "viz"; index: number };

const VIZ_RE = /\[VIZ:(\d+)\]/g;

function parseSegments(content: string): Segment[] {
    const segs: Segment[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    VIZ_RE.lastIndex = 0;
    while ((m = VIZ_RE.exec(content)) !== null) {
        if (m.index > last) segs.push({ type: "text", text: content.slice(last, m.index) });
        segs.push({ type: "viz", index: parseInt(m[1], 10) });
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
export default function ChatContent({ content, sessionId, className }: ChatContentProps) {
    const segments = useMemo(() => parseSegments(normalizeContent(content)), [content]);

    return (
        <div className={className}>
            {segments.map((seg, i) =>
                seg.type === "text" ? (
                    seg.text.trim() ? <MarkdownLatex key={i} content={seg.text} /> : null
                ) : (
                    <VizSlot key={i} index={seg.index} sessionId={sessionId} />
                )
            )}
        </div>
    );
}

function VizSlot({ index, sessionId }: { index: number; sessionId?: string }) {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";
    const ref = useRef<HTMLDivElement>(null);
    const [status, setStatus] = useState<VizStatus | undefined>(undefined);
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
        if (!sessionId || !accessToken || !inView || isTerminal(statusRef.current)) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;

        const tick = async () => {
            try {
                const list = await fetchVisualizationsStatus(sessionId, accessToken, index);
                if (cancelled) return;
                const found = list.find((v) => v.viz_index === index) ?? list[0];
                if (found) {
                    setStatus(found);
                    if (isTerminal(found)) return; // stop polling
                }
            } catch {
                // keep polling through transient errors
            }
            if (!cancelled) timer = setTimeout(tick, POLL_MS);
        };
        tick();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [sessionId, accessToken, inView, index]);

    // Container is ALWAYS rendered (persistent), showing the current state.
    return (
        <div ref={ref} className="my-4">
            {isReady(status) ? (
                <VizVideo url={status!.video_url!} />
            ) : isPermanentFail(status) ? (
                <VizFrame icon={<VideoOff className="w-5 h-5" />} label="This visual couldn't be generated" />
            ) : status?.render_status === "failed" ? (
                <VizFrame icon={<RefreshCw className="w-5 h-5 animate-spin" />} label="Retrying visual…" pulse />
            ) : (
                <VizFrame icon={<Loader2 className="w-5 h-5 animate-spin" />} label="Rendering visual…" pulse />
            )}
        </div>
    );
}

function VizVideo({ url }: { url: string }) {
    // Auto-play + loop, muted so browsers allow it; no controls (the play button
    // covering the animation is poor UX for short teaching clips).
    return (
        <div className="rounded-2xl overflow-hidden border border-border bg-black aspect-video w-full">
            <video
                src={url}
                autoPlay
                loop
                muted
                playsInline
                preload="metadata"
                className="w-full h-full object-contain"
            />
        </div>
    );
}

function VizFrame({ icon, label, pulse }: { icon: React.ReactNode; label: string; pulse?: boolean }) {
    return (
        <div
            className={`rounded-2xl border border-border bg-muted/40 aspect-video w-full flex items-center justify-center ${
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
