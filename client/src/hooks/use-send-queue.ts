/**
 * FIFO send queue for the chat inputs.
 *
 * The student used to be locked out of the input box while the tutor's reply
 * streamed. Now every message goes through this queue instead: it is shown in
 * the thread straight away and sent the moment the previous reply has finished
 * cleanly.
 *
 * The drain is driven by the *resolution* of each send, not by a busy flag
 * flipping back, so a stream that dies halfway never releases the next message
 * into a broken connection. A failed send stops the queue with that message
 * marked `error` — the rest stay queued, in order, behind it.
 */
import { useCallback, useEffect, useRef, useState } from "react";

export type QueuedStatus = "queued" | "sending" | "error";

export interface QueuedMessage {
    id: string;
    content: string;
    status: QueuedStatus;
}

export interface UseSendQueue {
    /**
     * Messages to render after the thread, oldest first — those still waiting
     * and those that failed, but **not** the one in flight.
     *
     * Every surface adds its own user bubble to the thread the instant `send`
     * starts, so a `sending` entry here would be a second copy of a message
     * already on screen, sitting under the tutor's typing indicator until the
     * reply landed. The in-flight message stays in the queue internally; it
     * just isn't rendered twice. It reappears here if the send fails.
     */
    pending: QueuedMessage[];
    /** Accepts a message. Sends immediately if the queue is idle, else queues it. */
    enqueue: (text: string) => void;
    /** Re-runs a failed message and resumes the queue behind it. */
    retry: (id: string) => void;
    /**
     * Drops a message and resumes the queue behind it — the student cancelling
     * one they changed their mind about, or clearing one that failed. Safe on
     * anything in `pending`: the in-flight message is never rendered, so there
     * is nothing to cancel that has already gone to the backend.
     */
    dismiss: (id: string) => void;
}

let seq = 0;

export interface SendQueueOptions {
    /**
     * Drop a failed message instead of keeping it with a Retry button. For a
     * surface that already has its own retry affordance for the failed message
     * — keeping it here too would show the student two copies of it.
     * The queue still halts either way.
     */
    dropFailed?: boolean;
}

/**
 * @param send Delivers one message. Must resolve `true` only on a clean,
 *   complete reply — `false` (or a throw) halts the queue for retry.
 */
export function useSendQueue(send: (text: string) => Promise<boolean>, options: SendQueueOptions = {}): UseSendQueue {
    const dropFailed = options.dropFailed ?? false;
    const [pending, setPending] = useState<QueuedMessage[]>([]);

    // The queue lives in a ref so the drain loop always reads the current list;
    // `pending` is the render mirror.
    const queue = useRef<QueuedMessage[]>([]);
    const running = useRef(false);
    const mounted = useRef(true);

    // Callers rebuild `send` on every render; the loop must call the latest one
    // without being re-created (which would let two loops run at once).
    const sendRef = useRef(send);
    useEffect(() => {
        sendRef.current = send;
    }, [send]);

    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
        };
    }, []);

    // The in-flight message is filtered out of the render mirror, not out of
    // the queue: the surface is already showing it in the thread. Both updates
    // land in the same React batch — the queue drops it in the very render the
    // surface adds its bubble — so there is no flicker between the two.
    const sync = useCallback(() => {
        if (mounted.current) setPending(queue.current.filter((m) => m.status !== "sending"));
    }, []);

    const setStatus = useCallback(
        (id: string, status: QueuedStatus) => {
            queue.current = queue.current.map((m) => (m.id === id ? { ...m, status } : m));
            sync();
        },
        [sync],
    );

    const drain = useCallback(async () => {
        if (running.current) return;
        running.current = true;
        try {
            while (mounted.current) {
                const head = queue.current[0];
                // Nothing left, or the head failed and is waiting on the
                // student — either way the queue holds here.
                if (!head || head.status === "error") break;

                setStatus(head.id, "sending");
                let ok = false;
                try {
                    ok = await sendRef.current(head.content);
                } catch {
                    ok = false;
                }
                if (!mounted.current) break;

                if (ok || dropFailed) {
                    queue.current = queue.current.filter((m) => m.id !== head.id);
                    sync();
                    // A failure still halts: the messages behind it must not be
                    // fired into a connection that just dropped.
                    if (!ok) break;
                } else {
                    setStatus(head.id, "error");
                    break;
                }
            }
        } finally {
            running.current = false;
        }
    }, [dropFailed, setStatus, sync]);

    const enqueue = useCallback(
        (text: string) => {
            const trimmed = text.trim();
            if (!trimmed) return;
            queue.current = [...queue.current, { id: `q${++seq}`, content: trimmed, status: "queued" }];
            sync();
            void drain();
        },
        [drain, sync],
    );

    const retry = useCallback(
        (id: string) => {
            setStatus(id, "queued");
            void drain();
        },
        [drain, setStatus],
    );

    const dismiss = useCallback(
        (id: string) => {
            queue.current = queue.current.filter((m) => m.id !== id);
            sync();
            void drain();
        },
        [drain, sync],
    );

    return { pending, enqueue, retry, dismiss };
}
