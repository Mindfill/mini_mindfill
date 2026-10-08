import { RotateCcw, X } from "lucide-react";
import ChatBubble from "@/components/chat/ChatBubble";
import type { QueuedMessage } from "@/hooks/use-send-queue";

/**
 * The student's messages that are waiting on the queue, rendered after the
 * committed thread. A message appears here the instant it is submitted, so
 * typing while the tutor is still answering feels no different from typing
 * when it isn't.
 *
 * Used by the three surfaces that render with ChatBubble; the notes lesson has
 * its own StudentMessage and renders its queue inline.
 */
export default function PendingMessages({
    pending,
    onRetry,
    onDismiss,
}: {
    pending: QueuedMessage[];
    onRetry: (id: string) => void;
    onDismiss: (id: string) => void;
}) {
    if (pending.length === 0) return null;

    return (
        <>
            {pending.map((m) => (
                <div key={m.id} className={m.status === "error" ? "" : "opacity-70"}>
                    <ChatBubble role="user" content={m.content} />
                    <QueuedNote item={m} onRetry={onRetry} onDismiss={onDismiss} />
                </div>
            ))}
        </>
    );
}

/**
 * One line under the bubble: waiting with a way to cancel, or failed with a
 * way out. There is no "sending" state here — the queue stops rendering a
 * message once it is in flight, because the thread is showing it by then.
 */
export function QueuedNote({
    item,
    onRetry,
    onDismiss,
}: {
    item: QueuedMessage;
    onRetry: (id: string) => void;
    onDismiss: (id: string) => void;
}) {
    if (item.status === "error") {
        return (
            <div className="flex items-center justify-end gap-3 mt-1 pr-11 text-[11px] text-red-700 dark:text-red-400">
                <span>Didn't send.</span>
                <button onClick={() => onRetry(item.id)} className="inline-flex items-center gap-1 font-semibold underline">
                    <RotateCcw className="w-3 h-3" /> Retry
                </button>
                <button onClick={() => onDismiss(item.id)} aria-label="Discard this message" className="inline-flex items-center gap-1">
                    <X className="w-3 h-3" />
                </button>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-end gap-2 mt-1 pr-11 text-[11px] text-muted-foreground">
            <span role="status">Queued</span>
            <button
                onClick={() => onDismiss(item.id)}
                aria-label="Cancel this message"
                title="Cancel"
                // Tap target is bigger than the glyph (-m-1 p-1) so it is
                // hittable on a phone without pushing the line taller.
                className="-m-1 p-1 inline-flex items-center hover:text-foreground"
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
}
