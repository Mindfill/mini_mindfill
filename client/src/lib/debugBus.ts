/**
 * TEMPORARY debug bus — feeds the on-screen DebugOverlay so we can diagnose the
 * realtime/websocket + visualization issues without DevTools. Remove this file
 * (and its usages in api.ts, note-chat, lesson-chat, App.tsx) once fixed.
 */

export interface VizDebugEntry {
    time: string;
    sessionId: string;
    index: number;
    httpStatus: number | string;
    count: number;
    firstVideoUrl: string | null;
    firstRenderStatus: string | null;
}

let pageInfo: Record<string, unknown> = {};
const vizEntries: VizDebugEntry[] = [];

export function setPageDebug(info: Record<string, unknown>) {
    pageInfo = { ...pageInfo, ...info };
}

export function pushVizDebug(entry: VizDebugEntry) {
    vizEntries.unshift(entry);
    if (vizEntries.length > 6) vizEntries.length = 6;
}

export function getDebugSnapshot() {
    return { pageInfo, vizEntries: [...vizEntries] };
}
