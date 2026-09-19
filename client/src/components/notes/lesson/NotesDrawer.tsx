import { useEffect, useRef, useState } from "react";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import MarkdownLatex from "@/components/ui/markdown-latex";
import { fetchNoteText, type NoteSectionText } from "@/lib/noteLessonApi";

/**
 * Spec §7 — the full extracted note as a read-only bottom sheet (~85% height).
 * The lesson underneath stays mounted, so closing returns to exactly where the
 * student was. Loaded on first open and kept for the visit.
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
    const [sections, setSections] = useState<NoteSectionText[] | null>(null);
    const [error, setError] = useState(false);
    const currentRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (!open || sections || !accessToken) return;
        setError(false);
        fetchNoteText(noteId, accessToken)
            .then(setSections)
            .catch(() => setError(true));
    }, [open, sections, noteId, accessToken]);

    // Land on the section being studied.
    useEffect(() => {
        if (!open || !sections) return;
        const t = setTimeout(() => currentRef.current?.scrollIntoView({ block: "start" }), 250);
        return () => clearTimeout(t);
    }, [open, sections, currentSection]);

    return (
        <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
            <DrawerContent className="h-[85dvh] max-w-3xl mx-auto">
                <div className="px-5 pt-3 pb-2 border-b border-border">
                    <DrawerTitle className="text-base">Your notes</DrawerTitle>
                    <DrawerDescription className="text-xs">Read-only · swipe down to return to the lesson</DrawerDescription>
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6" data-vaul-no-drag>
                    {error && <p className="text-sm text-muted-foreground">Couldn't load your notes. Close and try again.</p>}
                    {!sections && !error && (
                        <div className="space-y-3" aria-label="Loading notes">
                            {[80, 95, 70, 88].map((w) => (
                                <div key={w} className="h-3 rounded bg-muted animate-pulse" style={{ width: `${w}%` }} />
                            ))}
                        </div>
                    )}
                    {sections?.map((s) => {
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
            </DrawerContent>
        </Drawer>
    );
}
