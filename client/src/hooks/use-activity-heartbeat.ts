import { useEffect, useRef } from "react";
import { postActivityHeartbeat } from "@/lib/api";

const TICK_MS = 1000;
const FLUSH_INTERVAL_S = 25;

/**
 * Tracks real page-visible time (paused when the tab is hidden or the window
 * loses focus) and periodically reports it to the usage-graph backend. Mount
 * this once on any page that should count toward study-time dashboards
 * (lesson chat, notes chat, secondary subsections).
 */
export function useActivityHeartbeat(accessToken: string | undefined) {
    const secondsRef = useRef(0);
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;

    useEffect(() => {
        if (!accessToken) return;

        const isActive = () => document.visibilityState === "visible" && document.hasFocus();

        const flush = (keepalive = false) => {
            const seconds = secondsRef.current;
            const token = tokenRef.current;
            if (seconds <= 0 || !token) return;
            secondsRef.current = 0;
            postActivityHeartbeat(seconds, token, keepalive).catch(() => {});
        };

        const tickId = window.setInterval(() => {
            if (isActive()) secondsRef.current += 1;
        }, TICK_MS);

        const flushId = window.setInterval(() => flush(), FLUSH_INTERVAL_S * 1000);

        const handleVisibilityChange = () => {
            if (document.visibilityState === "hidden") flush(true);
        };
        const handleBeforeUnload = () => flush(true);

        document.addEventListener("visibilitychange", handleVisibilityChange);
        window.addEventListener("beforeunload", handleBeforeUnload);

        return () => {
            window.clearInterval(tickId);
            window.clearInterval(flushId);
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            window.removeEventListener("beforeunload", handleBeforeUnload);
            flush(true);
        };
    }, [accessToken]);
}
