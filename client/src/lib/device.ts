/**
 * Multi-device enforcement (Feature 01). A device token identifies this
 * browser for the 2-device cap — it is not a security credential; the
 * Supabase JWT still gates every request. See docs/feature_01_multidevice_subscription_members.md.
 */

const TOKEN_KEY = "x-device-token";
const TOKEN_COOKIE_MAX_AGE_DAYS = 365;

export function getDeviceToken(): string | null {
    try {
        const stored = localStorage.getItem(TOKEN_KEY);
        if (stored) return stored;
    } catch {
        // localStorage unavailable (private mode, etc.) — fall through to cookie.
    }
    return getCookie(TOKEN_KEY);
}

export function setDeviceToken(token: string): void {
    try {
        localStorage.setItem(TOKEN_KEY, token);
    } catch {
        // ignore — cookie copy below still works
    }
    setCookie(TOKEN_KEY, token, TOKEN_COOKIE_MAX_AGE_DAYS);
}

function getCookie(name: string): string | null {
    const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return match ? decodeURIComponent(match[1]) : null;
}

function setCookie(name: string, value: string, maxAgeDays: number): void {
    const maxAge = maxAgeDays * 24 * 60 * 60;
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

/**
 * Canvas + UA + screen + timezone + language fingerprint, used only as a
 * fallback to recognize a returning browser when its token is missing
 * (storage cleared) — never as a primary auth signal.
 */
export async function computeFingerprint(): Promise<string> {
    let canvasSignal = "";
    try {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (ctx) {
            ctx.textBaseline = "top";
            ctx.font = "14px 'Arial'";
            ctx.fillText("techcess-fp", 2, 2);
            canvasSignal = canvas.toDataURL();
        }
    } catch {
        // canvas fingerprinting unavailable — proceed with the remaining signals
    }

    const raw = [
        canvasSignal,
        navigator.userAgent,
        `${screen.width}x${screen.height}`,
        Intl.DateTimeFormat().resolvedOptions().timeZone,
        navigator.language,
    ].join("|");

    try {
        const bytes = new TextEncoder().encode(raw);
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return Array.from(new Uint8Array(digest))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("");
    } catch {
        // SubtleCrypto unavailable (very old browser, non-HTTPS context) — the
        // fallback only needs to be stable per-browser, not cryptographically strong.
        let hash = 0;
        for (let i = 0; i < raw.length; i++) {
            hash = (hash * 31 + raw.charCodeAt(i)) | 0;
        }
        return Math.abs(hash).toString(16);
    }
}

export interface DeviceInfo {
    device_token: string;
    device_name: string | null;
    last_seen_at: string;
    registered_at: string;
}

export interface RegisterDeviceResult {
    ok: boolean;
    devices?: DeviceInfo[];
}

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL || "https://mindfill-api.onrender.com").trim().replace(/[`'"]/g, "");

/**
 * Called once per sign-in (see hooks/use-auth.tsx's SIGNED_IN handler). The
 * server always mints a fresh token — this is what kills token fixation —
 * except a recognized returning device (by fingerprint) rotates its existing
 * slot instead of consuming a new one, so re-logging in on the same browser
 * never eats into the 2-device cap.
 */
export async function registerDevice(accessToken: string): Promise<RegisterDeviceResult> {
    const fingerprint_hash = await computeFingerprint();

    const res = await fetch(`${BACKEND_URL}/devices/register`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ fingerprint_hash }),
    });

    if (res.status === 403) {
        const body = await res.json().catch(() => null);
        return { ok: false, devices: body?.detail?.devices ?? [] };
    }

    if (!res.ok) {
        console.error("[device] Failed to register device:", res.status, await res.text().catch(() => ""));
        return { ok: true }; // fail open — don't block sign-in over a device-registration hiccup
    }

    const data = await res.json();
    if (data?.device_token) setDeviceToken(data.device_token);
    return { ok: true };
}
