import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Tooltip, TooltipTrigger } from "@/components/ui/tooltip";

interface KeyTermMarkProps {
    children?: React.ReactNode;
    defMap: Map<string, string>;
    onTap: (term: string, definition: string) => void;
    /** react-markdown passes the raw hast node + any HTML attrs through here. */
    [key: string]: any;
}

/**
 * Renders a highlighted key term. Desktop gets a hover tooltip (Radix, already
 * keyboard-accessible via focus). Touch devices get a tap -> bottom sheet
 * instead, since tooltips don't work on tap — `onTap` opens a single shared
 * Sheet owned by the parent (MarkdownLatex) rather than each mark mounting
 * its own dialog.
 */
export default function KeyTermMark({ children, defMap, onTap, ...rest }: KeyTermMarkProps) {
    const term = String(rest["data-term"] ?? rest.node?.properties?.["data-term"] ?? "");
    const definition = defMap.get(term);

    // Shouldn't happen (mark is only created for known terms) — fail safe to plain text.
    if (!definition) return <>{children}</>;

    const handleClick = (e: React.MouseEvent) => {
        const isCoarsePointer =
            typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
        if (isCoarsePointer) {
            e.preventDefault();
            onTap(term, definition);
        }
    };

    return (
        <Tooltip delayDuration={150}>
            <TooltipTrigger asChild>
                <mark
                    className="key-term bg-transparent border-b-2 border-[#22d3ee] font-inherit text-inherit cursor-help py-0 px-0 hover:bg-[#22d3ee]/15 hover:shadow-[0_0_8px_#22d3eeaa] hover:rounded-sm transition-all duration-200"
                    onClick={handleClick}
                >
                    {children}
                </mark>
            </TooltipTrigger>
            <TooltipPrimitive.Portal>
                {/* Radix positions this element via its own inline `transform`. The fade
                    animation must live on an INNER element instead — putting animate-in
                    (which also drives `transform`, even at identity) directly on this
                    positioned element fights Radix's positioning for the animation's
                    whole duration, so the popup sits at its unpositioned default spot
                    and only snaps to the real place beside the term once the animation
                    ends — that's the "flying in from the edge" bug. */}
                <TooltipPrimitive.Content sideOffset={4} className="group z-50">
                    <div className="max-w-xs whitespace-normal rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 duration-200 group-data-[state=closed]:animate-out group-data-[state=closed]:fade-out-0">
                        <span className="block font-bold text-sm mb-0.5 capitalize">{term}</span>
                        <span className="block text-xs text-muted-foreground leading-snug">{definition}</span>
                    </div>
                </TooltipPrimitive.Content>
            </TooltipPrimitive.Portal>
        </Tooltip>
    );
}
