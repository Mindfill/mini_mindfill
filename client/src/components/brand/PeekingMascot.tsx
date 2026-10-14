import { Component, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "wouter";
import { useUserProfile } from "@/hooks/use-user-profile";
import TechcessBot from "@/components/brand/TechcessBot";

/**
 * Every so often the mascot rises from the bottom-right corner, looks around
 * for a few seconds and ducks back down, so students keep meeting it around
 * the app. Tapping it gets a short encouraging line.
 *
 * It is deliberately polite:
 * - at most one peek per page visit, and never within PEEK_GAP_MS of the last
 *   one anywhere in the app;
 * - only once the page has settled (no loader on screen), the tab is
 *   visible, nothing is focused for typing, the student hasn't typed for a
 *   few seconds, and no dialog is open;
 * - never for people who ask their device for reduced motion, since the
 *   whole point of it is movement.
 *
 * Mounted once by App for signed-in app pages (lazy, so the landing page
 * doesn't pay for it).
 */

const PEEK_GAP_MS = 2 * 60_000;
const PEEK_SHOW_MS = 5_000;
const TALK_SHOW_MS = 5_500;
const LAST_PEEK_KEY = "techcess-last-peek";

/** Pages with a chat box along the bottom: the peek rises above it instead of
 *  covering the send button. */
const CHAT_PATHS = [/^\/lessons\//, /^\/notes\/[^/]+\/sections\//, /^\/secondary\/subsections\//];

const LINES = [
    (name: string) => (name ? `Hi ${name}! I'm your TECHCESS study buddy.` : "Hi! I'm your TECHCESS study buddy."),
    () => "Short sessions every day beat one long cram.",
    () => "Stuck? Ask the tutor to explain it another way.",
    () => "Try explaining today's idea in your own words. It sticks better.",
    () => "A quick quiz after a lesson locks it in.",
    () => "A two-minute break helps your brain file what you learned.",
    () => "Small steps, every day. You've got this.",
    () => "Every expert started exactly where you are.",
];

function readLastPeek(): number {
    try {
        return Number(localStorage.getItem(LAST_PEEK_KEY)) || 0;
    } catch {
        return 0;
    }
}

function writeLastPeek(t: number) {
    try {
        localStorage.setItem(LAST_PEEK_KEY, String(t));
    } catch {
        // Storage blocked (private mode): the per-visit limit still applies.
    }
}

function isTypingTarget(el: Element | null) {
    if (!el) return false;
    const tag = el.tagName;
    return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || (el as HTMLElement).isContentEditable;
}

function PeekingMascotInner() {
    const [location] = useLocation();
    const { fullName } = useUserProfile();
    const [phase, setPhase] = useState<"hidden" | "peek" | "talk">("hidden");
    const [line, setLine] = useState("");
    const lastKeyAt = useRef(0);
    const hideTimer = useRef<ReturnType<typeof setTimeout>>();

    const firstName = (fullName || "").trim().split(/\s+/)[0] ?? "";
    const onChatPage = CHAT_PATHS.some((re) => re.test(location));

    useEffect(() => {
        const onKey = () => {
            lastKeyAt.current = Date.now();
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, []);

    // One chance per page visit: wait for the page to settle, then peek if
    // nothing says it's a bad moment.
    useEffect(() => {
        setPhase("hidden");
        if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

        let tries = 0;
        let timer: ReturnType<typeof setTimeout>;

        const attempt = () => {
            if (Date.now() - readLastPeek() < PEEK_GAP_MS) return; // too soon anywhere in the app
            const busy =
                document.visibilityState !== "visible" ||
                isTypingTarget(document.activeElement) ||
                Date.now() - lastKeyAt.current < 8_000 ||
                // The phone nav drawer is always in the DOM as a dialog, so only
                // count dialogs that aren't hidden.
                !!document.querySelector('[aria-busy="true"], [role="dialog"]:not([aria-hidden="true"]), [role="alertdialog"]');
            if (busy) {
                if (++tries < 8) timer = setTimeout(attempt, 5_000);
                return;
            }
            writeLastPeek(Date.now());
            setPhase("peek");
            clearTimeout(hideTimer.current);
            hideTimer.current = setTimeout(() => setPhase((p) => (p === "peek" ? "hidden" : p)), PEEK_SHOW_MS);
        };

        timer = setTimeout(attempt, 6_000 + Math.random() * 6_000);
        return () => {
            clearTimeout(timer);
            clearTimeout(hideTimer.current);
        };
    }, [location]);

    const handleClick = () => {
        if (phase === "talk") {
            setPhase("hidden");
            return;
        }
        const pick = LINES[Math.floor(Math.random() * LINES.length)];
        setLine(pick(firstName));
        setPhase("talk");
        clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setPhase("hidden"), TALK_SHOW_MS);
    };

    const shown = phase !== "hidden";
    const bottom = onChatPage ? "calc(5.5rem + env(safe-area-inset-bottom, 0px))" : "0px";

    return (
        <div className="fixed right-3 md:right-8 z-40 pointer-events-none" style={{ bottom }} aria-hidden={!shown}>
            <div
                className="peek-bubble absolute bottom-full right-0 mb-1 w-max max-w-[min(16rem,calc(100vw-2rem))] rounded-2xl rounded-br-sm border border-border bg-card px-3.5 py-2.5 text-sm text-foreground shadow-lg"
                data-shown={phase === "talk"}
                role="status"
                aria-live="polite"
            >
                {phase === "talk" ? line : ""}
            </div>
            {/* The clip: the bot slides up from below this box's bottom edge. */}
            <div className="relative w-[68px] h-[60px] overflow-hidden">
                <button
                    type="button"
                    onClick={handleClick}
                    className="peek-bot absolute inset-x-0 top-0 mx-auto block rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
                    style={{ pointerEvents: shown ? "auto" : "none" }}
                    data-shown={shown}
                    tabIndex={shown ? 0 : -1}
                    aria-label="TECHCESS mascot. Tap for a study tip"
                    data-testid="peeking-mascot"
                >
                    <TechcessBot mood={phase === "talk" ? "wave" : "idle"} size={64} />
                </button>
            </div>
        </div>
    );
}

/** A decoration must never take the page down with it. */
class Quiet extends Component<{ children: ReactNode }, { failed: boolean }> {
    state = { failed: false };
    static getDerivedStateFromError() {
        return { failed: true };
    }
    componentDidCatch(err: unknown) {
        console.warn("[mascot] peek disabled after an error:", err);
    }
    render() {
        return this.state.failed ? null : this.props.children;
    }
}

export default function PeekingMascot() {
    return (
        <Quiet>
            <PeekingMascotInner />
        </Quiet>
    );
}
