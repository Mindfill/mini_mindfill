import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { fetchVisualizationsStatus, extractStreamingContent, type VizStatus } from "@/lib/api";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { Loader2 } from "lucide-react";

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
        // (possibly truncated) envelope — pull the content field out
        if (t.includes('"content"')) {
            const extracted = extractStreamingContent(raw);
            if (extracted) return extracted;
        }
        return raw;
    }
}

interface ChatContentProps {
    content: string;
    /** Session the message belongs to — needed to poll its [VIZ:N] videos. */
    sessionId?: string;
    /** History messages lazy-load videos on scroll instead of polling. */
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

const isSettled = (s?: VizStatus) => s?.render_status === "success" || s?.render_status === "failed";

/**
 * Renders a chat message: teaching text with any inline [VIZ:N] tokens replaced
 * by a rendering skeleton that becomes a video once the Manim worker finishes.
 * Live messages poll /visualizations/status; history messages lazy-load on view.
 */
export default function ChatContent({ content, sessionId, isHistory = false, className }: ChatContentProps) {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";

    const segments = useMemo(() => parseSegments(normalizeContent(content)), [content]);
    const vizIndexes = useMemo(
        () => segments.flatMap((s) => (s.type === "viz" ? [s.index] : [])),
        [segments]
    );

    const [statuses, setStatuses] = useState<Record<number, VizStatus>>({});
    const [timedOut, setTimedOut] = useState(false);

    // Live: poll every 2s until all viz are settled or 30s elapse.
    useEffect(() => {
        if (isHistory || !sessionId || !accessToken || vizIndexes.length === 0) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const start = Date.now();

        const poll = async () => {
            if (cancelled) return;
            try {
                const list = await fetchVisualizationsStatus(sessionId, accessToken);
                if (cancelled) return;
                const map: Record<number, VizStatus> = {};
                list.forEach((v) => (map[v.viz_index] = v));
                setStatuses((prev) => ({ ...prev, ...map }));
                if (vizIndexes.every((i) => isSettled(map[i]))) return; // all done
            } catch {
                // keep trying until the timeout
            }
            if (cancelled) return;
            if (Date.now() - start > 30000) {
                setTimedOut(true);
                return;
            }
            timer = setTimeout(poll, 2000);
        };
        poll();
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isHistory, sessionId, accessToken, vizIndexes.join(",")]);

    return (
        <div className={className}>
            {segments.map((seg, i) => {
                if (seg.type === "text") {
                    return seg.text.trim() ? <MarkdownLatex key={i} content={seg.text} /> : null;
                }
                return isHistory ? (
                    <HistoryViz key={i} index={seg.index} sessionId={sessionId} accessToken={accessToken} />
                ) : (
                    <LiveViz key={i} status={statuses[seg.index]} timedOut={timedOut} />
                );
            })}
        </div>
    );
}

function LiveViz({ status, timedOut }: { status?: VizStatus; timedOut: boolean }) {
    if (status?.render_status === "success" && status.video_url) return <VizVideo url={status.video_url} />;
    if (status?.render_status === "failed") return null;
    if (timedOut) return null; // gave up — silently drop the skeleton
    return <VizSkeleton />;
}

function HistoryViz({ index, sessionId, accessToken }: { index: number; sessionId?: string; accessToken: string }) {
    const ref = useRef<HTMLDivElement>(null);
    const [url, setUrl] = useState<string | null>(null);
    const [checked, setChecked] = useState(false);

    useEffect(() => {
        if (!sessionId || !accessToken) {
            setChecked(true);
            return;
        }
        const el = ref.current;
        if (!el) return;

        const io = new IntersectionObserver(
            (entries) => {
                if (!entries.some((e) => e.isIntersecting)) return;
                io.disconnect();
                fetchVisualizationsStatus(sessionId, accessToken, index)
                    .then((list) => {
                        const found = list.find((v) => v.viz_index === index) ?? list[0];
                        if (found?.render_status === "success" && found.video_url) setUrl(found.video_url);
                    })
                    .catch(() => {})
                    .finally(() => setChecked(true));
            },
            { rootMargin: "200px 0px" }
        );
        io.observe(el);
        return () => io.disconnect();
    }, [sessionId, accessToken, index]);

    if (url) return <VizVideo url={url} />;
    if (checked) return null; // observed, no video available
    return (
        <div ref={ref}>
            <VizSkeleton />
        </div>
    );
}

function VizVideo({ url }: { url: string }) {
    return (
        <div className="my-4 rounded-2xl overflow-hidden border border-border bg-black">
            <video src={url} controls playsInline className="w-full h-auto block" />
        </div>
    );
}

function VizSkeleton() {
    return (
        <div className="my-4 rounded-2xl border border-border bg-muted/40 aspect-video w-full flex items-center justify-center animate-pulse">
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="w-5 h-5 animate-spin" />
                <span className="text-[10px] font-bold tracking-widest uppercase">Rendering visual…</span>
            </div>
        </div>
    );
}
