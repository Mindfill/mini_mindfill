import { useEffect, useMemo, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import MarkdownLatex from "@/components/ui/markdown-latex";
import PdfViewer from "@/components/notes/PdfViewer";
import { isImageNote, resolveNoteFileUrl } from "@/lib/noteFile";
import { fetchNoteContent, type NoteContent } from "@/lib/noteLessonApi";

/**
 * Spec §7 — the student's notes as a read-only bottom sheet (~85% height). The lesson
 * underneath stays mounted, so closing returns to exactly where they were. Loaded on
 * first open and kept for the visit.
 *
 * Shows the ORIGINAL uploaded document, opened at the page the current section came
 * from. It used to show the extracted markdown, which reads badly raw — LaTeX and
 * markdown arrive as the literal symbols meant to be rendered away, so a maths-heavy
 * note was close to unreadable. The extracted text is now only the fallback, for a
 * photo note or when the file can't be fetched.
 */
export default function NotesDrawer({
    open,
    onOpenChange,
    noteId,
    accessToken,
    currentSection,
}: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    noteId: string;
    accessToken: string;
    currentSection: number;
}) {
    const [content, setContent] = useState<NoteContent | null>(null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    // Both the note and its signed URL have to be in hand before anything renders.
    // Showing the text as soon as the note arrived meant a flash of the old
    // unreadable-markdown view while the URL was still being signed.
    const [ready, setReady] = useState(false);
    const [error, setError] = useState(false);
    const currentRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!open || ready || !accessToken) return;
        let cancelled = false;
        setError(false);
        (async () => {
            try {
                const data = await fetchNoteContent(noteId, accessToken);
                if (cancelled) return;
                // The stored link is a public-object URL while the bucket is private, so
                // a signed URL has to be minted client-side with the logged-in client.
                const resolved = await resolveNoteFileUrl(data.file_url);
                if (cancelled) return;
                setContent(data);
                setFileUrl(resolved);
                setReady(true);
            } catch {
                if (!cancelled) setError(true);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [open, ready, noteId, accessToken]);

    const section = useMemo(
        () => content?.sections.find((s) => s.section_index === currentSection) ?? null,
        [content, currentSection],
    );

    const image = isImageNote(content?.file_name);
    const showDocument = ready && !!fileUrl && !!content;
    // Only when there is genuinely no file to show — an older note with no upload, or a
    // URL that couldn't be resolved. Never as a staging state.
    const showText = ready && !!content && !fileUrl;

    // Fallback view only: land on the section being studied.
    useEffect(() => {
        if (!open || !showText) return;
        const t = setTimeout(() => currentRef.current?.scrollIntoView({ block: "start" }), 250);
        return () => clearTimeout(t);
    }, [open, showText, currentSection]);

    const pageLabel = section?.page_range ? `Page ${section.page_range}` : null;

    return (
        <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
            <DrawerContent className="h-[85dvh] max-w-3xl mx-auto">
                <div className="px-5 pt-3 pb-2 border-b border-border">
                    <DrawerTitle className="text-base">Your notes</DrawerTitle>
                    <DrawerDescription className="text-xs">
                        {showDocument && pageLabel
                            ? `${pageLabel} · ${section?.title ?? ""} · swipe down to return to the lesson`
                            : "Read-only · swipe down to return to the lesson"}
                    </DrawerDescription>
                </div>

                <div className="flex-1 min-h-0 overflow-hidden" data-vaul-no-drag>
                    {error && (
                        <p className="px-5 py-4 text-sm text-muted-foreground">
                            Couldn't load your notes. Close and try again.
                        </p>
                    )}

                    {!ready && !error && (
                        <div className="px-5 py-4 space-y-3" aria-label="Loading notes">
                            {[80, 95, 70, 88].map((w) => (
                                <div
                                    key={w}
                                    className="h-3 rounded bg-muted animate-pulse"
                                    style={{ width: `${w}%` }}
                                />
                            ))}
                        </div>
                    )}

                    {showDocument &&
                        (image ? (
                            <div className="h-full overflow-y-auto px-2 py-4 flex justify-center">
                                <img
                                    src={fileUrl!}
                                    alt={content!.file_name ?? "Your note"}
                                    className="max-w-full h-auto rounded-sm shadow-lg bg-white"
                                />
                            </div>
                        ) : (
                            <PdfViewer url={fileUrl!} scrollToPage={section?.page_start ?? undefined} />
                        ))}

                    {/* Fallback: the extracted text, when there is no file to show. */}
                    {showText && (
                        <div className="h-full overflow-y-auto px-5 py-4 space-y-6">
                            <p className="text-xs text-muted-foreground border border-border rounded-lg px-3 py-2">
                                Showing the extracted text — the original file for this note
                                couldn't be loaded.
                            </p>
                            {content!.sections.map((s) => {
                                const current = s.section_index === currentSection;
                                return (
                                    <section
                                        key={s.section_index}
                                        ref={current ? currentRef : undefined}
                                        className={`scroll-mt-2 ${current ? "border-l-2 border-primary pl-3" : "pl-[14px]"}`}
                                        aria-current={current ? "true" : undefined}
                                    >
                                        <h3 className="text-sm font-semibold mb-2">{s.title}</h3>
                                        <div className="text-[13px] leading-relaxed text-foreground/90">
                                            <MarkdownLatex content={s.content} />
                                        </div>
                                    </section>
                                );
                            })}
                        </div>
                    )}
                </div>
            </DrawerContent>
        </Drawer>
    );
}
