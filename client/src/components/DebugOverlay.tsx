import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/hooks/use-auth";
import { useCredits } from "@/hooks/use-credits";
import { getDebugSnapshot } from "@/lib/debugBus";

/**
 * TEMPORARY on-screen debug panel for diagnosing the realtime/websocket +
 * visualization issues. Mounted in App.tsx. Remove once the issues are fixed.
 *
 * Shows: auth state, Supabase realtime connection + a live channel-subscribe
 * probe, credits (do they update live?), the current chat page's resolved
 * session id + [VIZ] token count, and the last few /visualizations/status
 * calls. The "Copy" button copies everything as text to paste back.
 */
export default function DebugOverlay() {
    const { session, isLoading } = useAuth();
    const { credits, subscriptionStatus, isPaid } = useCredits();

    const [open, setOpen] = useState(true);
    const [hidden, setHidden] = useState(false);
    const [, setTick] = useState(0);
    const [channelStatus, setChannelStatus] = useState<string>("(probing…)");
    const [realtimeConnected, setRealtimeConnected] = useState<string>("?");
    const [copied, setCopied] = useState(false);

    // Re-render once a second so the live values refresh.
    useEffect(() => {
        const id = setInterval(() => setTick((t) => t + 1), 1000);
        return () => clearInterval(id);
    }, []);

    // Poll the realtime socket connection state.
    useEffect(() => {
        const id = setInterval(() => {
            try {
                const rt: any = (supabase as any).realtime;
                const connected = typeof rt?.isConnected === "function" ? rt.isConnected() : undefined;
                const state = typeof rt?.connectionState === "function" ? rt.connectionState() : undefined;
                setRealtimeConnected(`${connected === true ? "yes" : connected === false ? "no" : "?"}${state ? ` (${state})` : ""}`);
            } catch {
                setRealtimeConnected("error");
            }
        }, 1000);
        return () => clearInterval(id);
    }, []);

    // A dedicated probe channel: its subscribe status directly tests whether the
    // websocket + postgres_changes subscription actually works.
    useEffect(() => {
        if (!session?.user?.id) {
            setChannelStatus("(no session)");
            return;
        }
        const channel = supabase
            .channel("debug-probe")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "user_credits" },
                () => {}
            )
            .subscribe((status) => setChannelStatus(status));
        return () => {
            supabase.removeChannel(channel);
        };
    }, [session?.user?.id]);

    if (hidden) return null;

    const snap = getDebugSnapshot();
    const lines: string[] = [
        `auth: loading=${isLoading} session=${!!session} user=${session?.user?.id?.slice(0, 8) ?? "-"}`,
        `realtime.connected: ${realtimeConnected}`,
        `channel.subscribe: ${channelStatus}`,
        `credits: ${credits ?? "null"}  sub=${subscriptionStatus ?? "null"}  isPaid=${isPaid}`,
        `page: ${JSON.stringify(snap.pageInfo)}`,
        `viz calls (${snap.vizEntries.length}):`,
        ...snap.vizEntries.map(
            (v) =>
                `  ${v.time} sid=${v.sessionId.slice(0, 8)} i=${v.index} http=${v.httpStatus} n=${v.count} url=${v.firstVideoUrl ? "yes" : "no"} rs=${v.firstRenderStatus ?? "-"}`
        ),
    ];
    const text = lines.join("\n");

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            setCopied(false);
        }
    };

    return (
        <div
            style={{
                position: "fixed",
                right: 8,
                bottom: 8,
                zIndex: 99999,
                maxWidth: 380,
                fontFamily: "ui-monospace, Menlo, Consolas, monospace",
                fontSize: 11,
                lineHeight: 1.45,
                color: "#e5e7eb",
                background: "rgba(10,10,14,0.92)",
                border: "1px solid #374151",
                borderRadius: 10,
                boxShadow: "0 8px 30px rgba(0,0,0,0.5)",
            }}
        >
            <div
                style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 8,
                    padding: "6px 10px",
                    borderBottom: open ? "1px solid #374151" : "none",
                }}
            >
                <strong style={{ color: "#fbbf24" }}>DEBUG</strong>
                <div style={{ display: "flex", gap: 6 }}>
                    <button onClick={copy} style={btn}>{copied ? "Copied!" : "Copy"}</button>
                    <button onClick={() => setOpen((o) => !o)} style={btn}>{open ? "Hide" : "Show"}</button>
                    <button onClick={() => setHidden(true)} style={btn}>✕</button>
                </div>
            </div>
            {open && (
                <pre style={{ margin: 0, padding: "8px 10px", whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: 260, overflowY: "auto" }}>
                    {text}
                </pre>
            )}
        </div>
    );
}

const btn: React.CSSProperties = {
    background: "#1f2937",
    color: "#e5e7eb",
    border: "1px solid #374151",
    borderRadius: 6,
    padding: "2px 8px",
    fontSize: 11,
    cursor: "pointer",
};
