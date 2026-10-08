/**
 * Voice input — streaming transcription session config.
 *
 * The AssemblyAI API key never reaches the browser. `/voice/token` trades the
 * student's bearer token for a token that expires in a couple of minutes and
 * can only open a streaming session, and hands back the endpoint and model it
 * was minted for so switching model or region is a backend deploy.
 */
import { BACKEND_URL, authHeaders } from "./api";

export interface VoiceSessionConfig {
    token: string;
    expires_in_seconds: number;
    ws_url: string;
    speech_model: string;
    sample_rate: number;
}

/**
 * Voice can't be used at all right now — either switched off server-side (no
 * API key) or this student isn't paying. Both hide the mic rather than leaving
 * a button that only ever fails.
 */
export class VoiceUnavailableError extends Error {
    reason: "disabled" | "subscription_required";
    constructor(reason: "disabled" | "subscription_required") {
        super(reason === "subscription_required" ? "Voice input needs a subscription" : "Voice input is not available");
        this.name = "VoiceUnavailableError";
        this.reason = reason;
    }
}

export async function fetchVoiceToken(accessToken: string): Promise<VoiceSessionConfig> {
    const res = await fetch(`${BACKEND_URL}/voice/token`, { headers: authHeaders(accessToken) });
    if (res.status === 503) throw new VoiceUnavailableError("disabled");
    if (res.status === 403) throw new VoiceUnavailableError("subscription_required");
    if (!res.ok) throw new Error("Could not start voice input");
    return res.json();
}

/**
 * Builds the streaming WebSocket URL.
 *
 * `format_turns` is on so the text that lands in the input box already has
 * punctuation and capitalisation — the student is about to send it as a
 * message, not read a raw caption feed.
 */
export function buildStreamUrl(cfg: VoiceSessionConfig): string {
    const params = new URLSearchParams({
        token: cfg.token,
        speech_model: cfg.speech_model,
        sample_rate: String(cfg.sample_rate),
        encoding: "pcm_s16le",
        format_turns: "true",
    });
    return `${cfg.ws_url}?${params.toString()}`;
}
