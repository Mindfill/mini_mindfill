import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * Loading placeholders shaped like the page that's about to appear. Used for
 * every load inside the app (switching tabs, opening a lesson or a note), where
 * the sidebar stays put and only the content area is waiting. Only opening the
 * app and signing in use the mascot (TechcessLoader).
 *
 * Each one mirrors its page's outer container (max width + padding) so the
 * content lands where the placeholder was, without a jump.
 */

/** The shared Skeleton's bg-muted all but vanishes on the dark theme's
 *  near-black background, so these shapes are lifted a little there. */
function Bone({ className }: { className?: string }) {
    return <Skeleton className={cn("dark:bg-white/[0.15]", className)} />;
}

function Busy({ label, className, children }: { label: string; className: string; children: ReactNode }) {
    return (
        <main className={className} role="status" aria-busy="true" aria-label={label}>
            {children}
            {/* Last, so it isn't the first child that space-y-* offsets from. */}
            <span className="sr-only">{label}…</span>
        </main>
    );
}

/** Uni + secondary Home: greeting, continue-learning card, two cards, a list. */
export function DashboardSkeleton() {
    return (
        <Busy label="Loading your dashboard" className="max-w-5xl mx-auto p-6 md:p-10 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Bone className="w-14 h-14 rounded-2xl" />
                    <div className="space-y-2.5">
                        <Bone className="h-7 w-56" />
                        <Bone className="h-4 w-40" />
                    </div>
                </div>
                <Bone className="h-10 w-36 rounded-full" />
            </div>
            <div className="glass-panel rounded-3xl p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div className="flex items-start gap-4">
                    <Bone className="w-12 h-12 rounded-2xl flex-shrink-0" />
                    <div className="space-y-2.5">
                        <Bone className="h-3 w-28" />
                        <Bone className="h-7 w-64 max-w-[60vw]" />
                        <Bone className="h-4 w-36" />
                    </div>
                </div>
                <Bone className="h-12 w-32 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[0, 1].map((i) => (
                    <div key={i} className="glass-panel rounded-2xl p-6 space-y-4">
                        <Bone className="h-3.5 w-32" />
                        <Bone className="h-28 w-full rounded-xl" />
                    </div>
                ))}
            </div>
            <div className="space-y-3">
                <Bone className="h-3.5 w-36" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass-panel rounded-xl p-4 space-y-2">
                        <Bone className="h-4 w-1/2" />
                        <Bone className="h-3 w-28" />
                    </div>
                ))}
            </div>
        </Busy>
    );
}

/** /courses: header bar, then a stack of course cards. */
export function CoursesSkeleton() {
    return (
        <div className="flex-1 flex flex-col" role="status" aria-busy="true" aria-label="Loading courses">
            <div className="glass-chip border-b border-border/50 px-8 py-6 flex items-center gap-3">
                <Bone className="w-16 h-16 rounded-2xl" />
                <div className="space-y-2">
                    <Bone className="h-7 w-32" />
                    <Bone className="h-4 w-44" />
                </div>
            </div>
            <div className="p-8 flex flex-col gap-6 max-w-5xl">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass-panel rounded-3xl p-6 space-y-4">
                        <Bone className="h-6 w-1/3" />
                        <Bone className="h-4 w-2/3" />
                        <div className="grid sm:grid-cols-3 gap-3 pt-2">
                            {[0, 1, 2].map((j) => (
                                <Bone key={j} className="h-16 rounded-xl" />
                            ))}
                        </div>
                    </div>
                ))}
            </div>
            <span className="sr-only">Loading courses…</span>
        </div>
    );
}

/** /notes: header with actions, course folders, then a list of notes. */
export function NotesSkeleton() {
    return (
        <Busy label="Loading your notes" className="max-w-4xl mx-auto p-6 md:p-10 space-y-10">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="space-y-2">
                    <Bone className="h-7 w-36" />
                    <Bone className="h-4 w-56" />
                </div>
                <div className="flex items-center gap-3">
                    <Bone className="h-10 w-10 rounded-xl" />
                    <Bone className="h-10 w-32 rounded-xl" />
                    <Bone className="h-10 w-36 rounded-xl" />
                </div>
            </div>
            <div className="space-y-4">
                <Bone className="h-3 w-20" />
                <div className="grid sm:grid-cols-2 gap-4">
                    {[0, 1].map((i) => (
                        <div key={i} className="glass-panel rounded-2xl p-5 space-y-3">
                            <Bone className="h-10 w-10 rounded-xl" />
                            <Bone className="h-5 w-2/3" />
                            <Bone className="h-3.5 w-24" />
                        </div>
                    ))}
                </div>
            </div>
            <div className="space-y-3">
                <Bone className="h-3 w-24" />
                {[0, 1, 2].map((i) => (
                    <div key={i} className="glass-panel rounded-xl p-4 flex items-center gap-3">
                        <Bone className="h-9 w-9 rounded-lg flex-shrink-0" />
                        <div className="flex-1 space-y-2">
                            <Bone className="h-4 w-1/2" />
                            <Bone className="h-3 w-28" />
                        </div>
                    </div>
                ))}
            </div>
        </Busy>
    );
}

/** /profile: header, then the details form and plan panels. */
export function ProfileSkeleton() {
    return (
        <Busy label="Loading your profile" className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
            <div className="flex items-center gap-4">
                <Bone className="w-14 h-14 rounded-2xl" />
                <div className="space-y-2">
                    <Bone className="h-7 w-28" />
                    <Bone className="h-4 w-52" />
                </div>
            </div>
            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
                {[0, 1, 2].map((i) => (
                    <div key={i} className="space-y-2">
                        <Bone className="h-3.5 w-24" />
                        <Bone className="h-10 w-full rounded-md" />
                    </div>
                ))}
                <div className="flex justify-end">
                    <Bone className="h-10 w-32 rounded-md" />
                </div>
            </div>
            <div className="glass-panel rounded-3xl p-6 md:p-8 space-y-4">
                <Bone className="h-5 w-40" />
                <Bone className="h-4 w-2/3" />
                <Bone className="h-20 w-full rounded-xl" />
            </div>
        </Busy>
    );
}

/** Secondary /learn: title, class tabs, a grid of subject cards. */
export function SubjectGridSkeleton() {
    return (
        <Busy label="Loading subjects" className="max-w-4xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <div className="space-y-5">
                <div className="space-y-3">
                    <Bone className="h-9 w-40" />
                    <Bone className="h-4 w-52" />
                </div>
                <Bone className="h-12 w-60 rounded-full" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                {[0, 1, 2, 3].map((i) => (
                    <div key={i} className="glass-panel rounded-2xl p-6 space-y-4">
                        <Bone className="h-6 w-1/2" />
                        <Bone className="h-4 w-5/6" />
                        <Bone className="h-2 w-full rounded-full" />
                    </div>
                ))}
            </div>
        </Busy>
    );
}

/** A lesson chat (uni lessons, note lessons): title bar, a few turns of
 *  conversation, the message box. Fills its column so the input sits at the
 *  bottom where the real one will appear. */
export function ChatSkeleton({ label = "Opening your lesson" }: { label?: string }) {
    return (
        <div className="flex-1 min-h-0 h-full flex flex-col" role="status" aria-busy="true" aria-label={label}>
            <div className="flex items-center gap-3 px-4 md:px-6 py-4 border-b border-border/50">
                <Bone className="h-4 w-14" />
                <Bone className="h-5 w-48 max-w-[50vw]" />
            </div>
            <div className="flex-1 min-h-0 overflow-hidden px-4 md:px-6 py-6">
                <div className="max-w-3xl mx-auto space-y-6">
                    {[0, 1].map((i) => (
                        <div key={i} className="space-y-6">
                            <div className="flex items-start gap-3">
                                <Bone className="w-8 h-8 rounded-lg flex-shrink-0" />
                                <div className="flex-1 glass-panel rounded-2xl rounded-tl-sm p-4 space-y-2.5">
                                    <Bone className="h-4 w-11/12" />
                                    <Bone className="h-4 w-4/5" />
                                    <Bone className="h-4 w-2/3" />
                                </div>
                            </div>
                            <div className="flex justify-end">
                                <Bone className="h-11 w-40 rounded-2xl rounded-tr-sm" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
            <div className="px-4 md:px-6 pb-5 pt-2">
                <Bone className="max-w-3xl mx-auto h-12 rounded-2xl" />
            </div>
            <span className="sr-only">{label}…</span>
        </div>
    );
}

/** Any other content page (a note, a course of notes, a chapter, a
 *  secondary lesson): heading, paragraphs, a figure-sized block. */
export function ContentSkeleton({ label = "Loading" }: { label?: string }) {
    return (
        <Busy label={label} className="max-w-4xl mx-auto px-4 py-8 md:p-10 space-y-8">
            <div className="space-y-3">
                <Bone className="h-3.5 w-24" />
                <Bone className="h-9 w-2/3" />
                <Bone className="h-4 w-1/3" />
            </div>
            <div className="glass-panel rounded-2xl p-6 space-y-3">
                <Bone className="h-4 w-full" />
                <Bone className="h-4 w-11/12" />
                <Bone className="h-4 w-4/5" />
                <Bone className="h-48 w-full rounded-xl mt-4" />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
                {[0, 1].map((i) => (
                    <div key={i} className="glass-panel rounded-2xl p-5 space-y-3">
                        <Bone className="h-5 w-1/2" />
                        <Bone className="h-4 w-5/6" />
                    </div>
                ))}
            </div>
        </Busy>
    );
}
