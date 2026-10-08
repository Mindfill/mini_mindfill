/**
 * Streaming voice input (AssemblyAI Universal-Streaming v3).
 *
 * Captures the microphone, streams 16 kHz PCM to AssemblyAI over a WebSocket,
 * and reports the transcript as it arrives so the caller can show it building
 * up in the input box. On stop the finished text is simply left with the
 * caller — it is editable text in a textarea, nothing more. Sending it goes
 * through the ordinary typed-message path.
 *
 * Deliberately self-contained: it owns the mic, the socket and the transcript,
 * and tells the caller only `status` and `transcript`.
 *
 * Edge cases handled, in the order they bite in practice:
 *  - Stop tapped before the socket opens → cancelled silently, no error.
 *  - Stop tapped mid-sentence → capture stops at once, but the socket is held
 *    open briefly to collect AssemblyAI's punctuated final turn, so the text
 *    left in the box reads like writing rather than a caption.
 *  - Socket drops mid-sentence → up to RECONNECT_ATTEMPTS silent reconnects,
 *    with the text transcribed so far preserved across them.
 *  - Reconnects exhausted → recording stops, the transcript is KEPT (losing a
 *    student's spoken sentence to a flaky connection is the worst outcome
 *    here), and a soft message is surfaced.
 *  - Microphone permission refused → a message that says what to do, and no
 *    retry loop.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { buildStreamUrl, fetchVoiceToken, VoiceUnavailableError, type VoiceSessionConfig } from "@/lib/voiceApi";

export type VoiceStatus = "idle" | "connecting" | "listening" | "finalising" | "unavailable";

/** Audio is sent in ~100ms frames: well inside AssemblyAI's 50–1000ms window. */
const SAMPLE_RATE = 16000;
const FRAME_SAMPLES = 1600;
const RECONNECT_ATTEMPTS = 2;
const RECONNECT_DELAY_MS = 400;

/**
 * How long to hold the socket open after the student taps stop, waiting for the
 * formatted final turn. The server answers a Terminate promptly, so this is
 * only a backstop — it is not a delay the student normally sits through.
 */
const FINALISE_TIMEOUT_MS = 2000;

/**
 * Worklet source, compiled from a Blob at runtime.
 *
 * An AudioWorklet has to be loaded from a URL, and keeping it inline avoids a
 * public asset whose path has to survive every bundler and deploy change.
 * It does one job: batch the render quantum into FRAME_SAMPLES and convert
 * float samples to the 16-bit PCM AssemblyAI expects.
 */
const WORKLET_SOURCE = `
class PCMFrameProcessor extends AudioWorkletProcessor {
    constructor(options) {
        super();
        this._size = options.processorOptions.frameSamples;
        this._buf = new Int16Array(this._size);
        this._n = 0;
    }
    process(inputs, outputs) {
        // Outputs are left as the zero-filled buffers they arrive as — the node
        // is wired through a muted gain purely so the graph keeps pulling it.
        const channel = inputs[0] && inputs[0][0];
        if (!channel) return true;
        for (let i = 0; i < channel.length; i++) {
            // Clamp before scaling: values just outside [-1,1] wrap around and
            // land as loud noise at the opposite polarity.
            const s = Math.max(-1, Math.min(1, channel[i]));
            this._buf[this._n++] = s < 0 ? s * 0x8000 : s * 0x7fff;
            if (this._n === this._size) {
                this.port.postMessage(this._buf.slice(0).buffer);
                this._n = 0;
            }
        }
        return true;
    }
}
registerProcessor('pcm-frame-processor', PCMFrameProcessor);
`;

let workletUrl: string | null = null;
function getWorkletUrl(): string {
    if (!workletUrl) {
        workletUrl = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: "application/javascript" }));
    }
    return workletUrl;
}

/** The server messages this hook acts on: Begin and the rest are ignored. */
interface ServerMessage {
    type?: string;
    turn_order?: number;
    transcript?: string;
    end_of_turn?: boolean;
    /** True once AssemblyAI has punctuated and capitalised this turn. */
    turn_is_formatted?: boolean;
}

export interface UseVoiceInput {
    status: VoiceStatus;
    /** The live transcript, rebuilt on every partial result. */
    transcript: string;
    /** A soft, already-phrased message. The transcript is never discarded with it. */
    error: string | null;
    start: () => void;
    stop: () => void;
    /** True when this browser can capture audio at all. */
    supported: boolean;
}

export function useVoiceInput(): UseVoiceInput {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";

    const [status, setStatus] = useState<VoiceStatus>("idle");
    const [transcript, setTranscript] = useState("");
    const [error, setError] = useState<string | null>(null);

    // One mutable bundle of everything that has to be torn down. Refs, not
    // state: teardown must not wait for a render.
    const ws = useRef<WebSocket | null>(null);
    const stream = useRef<MediaStream | null>(null);
    const audioCtx = useRef<AudioContext | null>(null);
    const node = useRef<AudioWorkletNode | null>(null);
    const mute = useRef<GainNode | null>(null);
    const cancelled = useRef(false);
    const config = useRef<VoiceSessionConfig | null>(null);
    const attempt = useRef(0);
    const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Stop was tapped and we are holding the socket open for the formatted
    // final turn. Distinct from `cancelled`: messages are still processed.
    const finalising = useRef(false);
    const finaliseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // `stop` is a stable callback, so it cannot read `status` from a closure.
    const statusRef = useRef<VoiceStatus>("idle");
    useEffect(() => {
        statusRef.current = status;
    }, [status]);

    // Transcript assembly. AssemblyAI re-sends a turn as it is refined (and
    // again, formatted, once it ends), so turns are held by index and joined
    // rather than appended — appending would duplicate every revision.
    const turns = useRef<Map<number, string>>(new Map());
    // Text from earlier sockets. A reconnect restarts turn_order at 0, which
    // would otherwise overwrite what was already said.
    const committed = useRef("");

    const supported =
        typeof window !== "undefined" &&
        !!navigator.mediaDevices?.getUserMedia &&
        typeof AudioContext !== "undefined" &&
        typeof WebSocket !== "undefined";

    /** The current socket's turns, in order, as one string. */
    const liveText = useCallback(
        () =>
            Array.from(turns.current.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([, text]) => text)
                .filter(Boolean)
                .join(" "),
        [],
    );

    const rebuild = useCallback(() => {
        setTranscript([committed.current, liveText()].filter(Boolean).join(" "));
    }, [liveText]);

    /** Releases the microphone and the audio graph, leaving the socket alone. */
    const stopCapture = useCallback(() => {
        node.current?.port.close();
        node.current?.disconnect();
        node.current = null;
        mute.current?.disconnect();
        mute.current = null;
        stream.current?.getTracks().forEach((t) => t.stop());
        stream.current = null;
        audioCtx.current?.close().catch(() => {});
        audioCtx.current = null;
    }, []);

    /** Releases everything. Never touches the transcript. */
    const teardown = useCallback(() => {
        for (const timer of [retryTimer, finaliseTimer]) {
            if (timer.current) {
                clearTimeout(timer.current);
                timer.current = null;
            }
        }
        const socket = ws.current;
        ws.current = null;
        if (socket) {
            // Drop the handlers first: closing fires onclose, which would
            // otherwise read as an unexpected drop and start reconnecting.
            socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
            if (socket.readyState === WebSocket.OPEN) {
                try {
                    socket.send(JSON.stringify({ type: "Terminate" }));
                } catch {
                    // Already gone; closing is enough.
                }
            }
            try {
                socket.close();
            } catch {
                // Already closing.
            }
        }
        stopCapture();
    }, [stopCapture]);

    /** End of the finalising wait, however it was reached. */
    const finish = useCallback(() => {
        finalising.current = false;
        cancelled.current = true;
        teardown();
        setStatus("idle");
    }, [teardown]);

    const stop = useCallback(() => {
        const socket = ws.current;
        // Not actually streaming yet (still fetching a token, or opening the
        // socket), or already finalising and the student is impatient — end it
        // now, silently. Whatever was transcribed stays in the box either way.
        if (statusRef.current !== "listening" || !socket || socket.readyState !== WebSocket.OPEN) {
            finish();
            return;
        }

        // Stop listening immediately — the mic indicator must go out on the tap,
        // not when the server replies — then let the server flush its final,
        // punctuated turn over the socket we are still holding.
        finalising.current = true;
        setStatus("finalising");
        stopCapture();
        try {
            socket.send(JSON.stringify({ type: "Terminate" }));
        } catch {
            finish();
            return;
        }
        finaliseTimer.current = setTimeout(finish, FINALISE_TIMEOUT_MS);
    }, [finish, stopCapture]);

    /** Opens a socket for the current config and pipes audio into it. */
    const connect = useCallback(() => {
        const cfg = config.current;
        if (!cfg || cancelled.current) return;

        const socket = new WebSocket(buildStreamUrl(cfg));
        socket.binaryType = "arraybuffer";
        ws.current = socket;

        socket.onopen = () => {
            if (cancelled.current) return;
            attempt.current = 0;
            setStatus("listening");
            setError(null);
            // Frames captured before the socket opened are dropped rather than
            // queued: stale audio arriving late transcribes as garbled text.
            const worklet = node.current;
            if (worklet) {
                worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
                    if (socket.readyState === WebSocket.OPEN) socket.send(e.data);
                };
            }
        };

        socket.onmessage = (e) => {
            if (cancelled.current || typeof e.data !== "string") return;
            let msg: ServerMessage;
            try {
                msg = JSON.parse(e.data);
            } catch {
                return;
            }

            if (msg.type === "Turn" && typeof msg.transcript === "string" && typeof msg.turn_order === "number") {
                turns.current.set(msg.turn_order, msg.transcript);
                rebuild();
                // The formatted close of the last turn is exactly what the
                // finalising wait was for.
                if (finalising.current && msg.end_of_turn && msg.turn_is_formatted) finish();
                return;
            }

            // The server's answer to our Terminate: nothing more is coming.
            if (msg.type === "Termination" && finalising.current) finish();
        };

        socket.onerror = () => {
            // onclose always follows; reconnecting is decided there so the two
            // paths cannot both fire.
        };

        socket.onclose = () => {
            if (cancelled.current || ws.current !== socket) return;
            ws.current = null;

            // Closed during the finalising wait — expected, we asked for it.
            if (finalising.current) {
                finish();
                return;
            }

            if (attempt.current < RECONNECT_ATTEMPTS) {
                attempt.current += 1;
                // Fold this socket's turns into the committed prefix — the next
                // session numbers its turns from zero again.
                committed.current = [committed.current, liveText()].filter(Boolean).join(" ");
                turns.current.clear();
                setStatus("connecting");
                retryTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
                return;
            }

            // Out of attempts: stop, but keep every word already transcribed.
            teardown();
            setStatus("idle");
            setError("Connection lost — what was transcribed is in the box.");
        };
    }, [finish, liveText, rebuild, teardown]);

    const start = useCallback(async () => {
        if (!supported || status === "connecting" || status === "listening" || status === "finalising") return;

        cancelled.current = false;
        finalising.current = false;
        attempt.current = 0;
        turns.current.clear();
        committed.current = "";
        setTranscript("");
        setError(null);
        setStatus("connecting");

        try {
            // Mic permission first. Asking for a token before the student has
            // agreed to be recorded burns a token on every refusal.
            const media = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
            });
            if (cancelled.current) {
                media.getTracks().forEach((t) => t.stop());
                return;
            }
            stream.current = media;

            const cfg = await fetchVoiceToken(accessToken);
            if (cancelled.current) return;
            config.current = cfg;

            // Asking the context for 16 kHz lets the browser resample, so the
            // worklet only has to convert float to int16.
            const ctx = new AudioContext({ sampleRate: SAMPLE_RATE });
            audioCtx.current = ctx;
            // Started from a tap, so it should already be running; a suspended
            // context would silently never call the worklet.
            if (ctx.state === "suspended") await ctx.resume();
            await ctx.audioWorklet.addModule(getWorkletUrl());
            if (cancelled.current) return;

            const source = ctx.createMediaStreamSource(media);
            const worklet = new AudioWorkletNode(ctx, "pcm-frame-processor", {
                numberOfInputs: 1,
                numberOfOutputs: 1,
                outputChannelCount: [1],
                processorOptions: { frameSamples: FRAME_SAMPLES },
            });
            node.current = worklet;
            // A worklet that reaches no destination is not guaranteed to be
            // pulled by the graph, so it runs into a silent gain node. Zero
            // gain, or the student hears themselves echoed back.
            const silence = ctx.createGain();
            silence.gain.value = 0;
            mute.current = silence;
            source.connect(worklet);
            worklet.connect(silence);
            silence.connect(ctx.destination);

            connect();
        } catch (err) {
            // Stop tapped while any of the above was in flight: silent, by spec.
            if (cancelled.current) {
                teardown();
                setStatus("idle");
                return;
            }
            teardown();
            if (err instanceof VoiceUnavailableError) {
                // Switched off, or not a subscriber: the mic hides itself.
                setStatus("unavailable");
                return;
            }
            setStatus("idle");
            const name = (err as DOMException)?.name;
            if (name === "NotAllowedError" || name === "SecurityError") {
                setError("Microphone blocked. Allow mic access in your browser to talk.");
            } else if (name === "NotFoundError") {
                setError("No microphone found.");
            } else {
                setError("Couldn't start voice input. Try again.");
            }
        }
    }, [accessToken, connect, status, supported, teardown]);

    // Leaving the page mid-sentence must release the mic, or the browser keeps
    // showing the recording indicator.
    useEffect(() => {
        return () => {
            cancelled.current = true;
            finalising.current = false;
            teardown();
        };
    }, [teardown]);

    return { status, transcript, error, start, stop, supported };
}
