import { motion, useReducedMotion } from "motion/react";
import { Check, Lock } from "lucide-react";
import { SUBSECTION_TYPE_LABEL, type TocSection, type TocSubsection } from "@/lib/secondaryApi";

/**
 * Circuit-board chapter navigation (sprint spec v2 §3).
 *
 * This is the approved comparison artboard "B · Current blue/glass system"
 * built for real: chips alternating left and right down the page, joined by
 * angular 90° traces with solder pads at every junction.
 *
 * Built ALONGSIDE the existing accordion (Board / List toggle on the chapter
 * page) rather than replacing it, so Feature 02's working navigation stays
 * until this has been judged in a browser.
 *
 * COLOUR departs from §3.2 on purpose. The spec specifies copper-on-navy;
 * that was compared against the app's own system on three 360px artboards and
 * rejected, because copper only works on a dark ground (~3:1 on white) and
 * would have made the lesson area dark-only. The tokens here are the app's —
 * --primary for live trace, --border for idle, glass panels for chips — so it
 * themes light and dark for free. The PCB *form* is unchanged.
 *
 * GEOMETRY. Everything horizontal is a percentage, so the zig-zag survives
 * any width without measuring: a chip occupies 62% of the column, inset 6%
 * from its own side, which puts the two node centres at 37% and 63%. A
 * connector is a fixed-height block that routes down from the source centre,
 * across the 26% between the centres, and down into the target — three CSS
 * boxes, no SVG, no layout measurement. §3.1's requirement is "no React Flow,
 * no canvas or graph library, light on budget Android", which this meets.
 */

const NODE_INSET = 6;    // % from the chip's own edge of the column
const NODE_WIDTH = 62;   // % of the column
const LEFT_CENTRE = NODE_INSET + NODE_WIDTH / 2;        // 37%
const RIGHT_CENTRE = 100 - NODE_INSET - NODE_WIDTH / 2; // 63%
const RUN_WIDTH = RIGHT_CENTRE - LEFT_CENTRE;           // 26%

const CONNECTOR_H = 44;        // px between chips
const CONNECTOR_H_LABEL = 68;  // taller where a section name sits on the run

type NodeState = "completed" | "active" | "available" | "locked";

function stateOf(sub: TocSubsection, currentId?: string | null): NodeState {
    if (sub.status === "completed") return "completed";
    if (sub.status === "in_progress") return "active";
    // §3.3's "Active — student is in this lesson". A student who finished one
    // lesson but hasn't opened the next has no in_progress row at all, so
    // without this the board shows a run of identical chips and never answers
    // "where am I?". The caller passes the lesson its Continue button targets.
    if (sub.available && sub.subsection_id === currentId) return "active";
    return sub.available ? "available" : "locked";
}

/** Angular trace between two chips: down, across, down. */
function Connector({
    fromLeft,
    live,
    label,
    interactive,
    delay,
}: {
    /** true when the trace leaves a left-hand chip and enters a right-hand one */
    fromLeft: boolean;
    live: boolean;
    label?: string | null;
    /** Light this trace up when the chip it feeds is hovered. Off for locked
     *  chips, which aren't going anywhere. */
    interactive: boolean;
    delay: number;
}) {
    const tone = live ? "bg-primary/70" : "bg-border";
    const padTone = live ? "bg-primary border-primary" : "bg-muted border-border";
    // A live trace carries a faint permanent glow; hovering the chip it feeds
    // pushes current through the whole run into it.
    const glow = [
        live ? "shadow-[0_0_6px_hsl(var(--primary)/0.5)]" : "",
        interactive
            ? "group-hover:bg-primary group-hover:shadow-[0_0_12px_hsl(var(--primary)/0.85)]"
            : "",
    ]
        .filter(Boolean)
        .join(" ");
    const padGlow = interactive
        ? "group-hover:bg-primary group-hover:border-primary group-hover:shadow-[0_0_10px_hsl(var(--primary)/0.8)]"
        : "";
    const source = fromLeft ? LEFT_CENTRE : RIGHT_CENTRE;
    const target = fromLeft ? RIGHT_CENTRE : LEFT_CENTRE;
    const height = label ? CONNECTOR_H_LABEL : CONNECTOR_H;
    const midY = height / 2;

    return (
        <div className="relative w-full" style={{ height }} aria-hidden="true">
            {/* Down, across, down — see the .trace-* note in index.css for why
                these are CSS animations rather than Framer transforms. */}
            <div
                className={`absolute w-[2px] trace-y ${tone} ${glow}`}
                style={{ left: `${source}%`, marginLeft: -1, top: 0, height: midY, animationDelay: `${delay}s` }}
            />
            <div
                className={`absolute h-[2px] trace-x ${fromLeft ? "trace-x-ltr" : "trace-x-rtl"} ${tone} ${glow}`}
                style={{
                    left: `${LEFT_CENTRE}%`,
                    width: `${RUN_WIDTH}%`,
                    top: midY - 1,
                    animationDelay: `${delay + 0.18}s`,
                }}
            />
            <div
                className={`absolute w-[2px] trace-y ${tone} ${glow}`}
                style={{ left: `${target}%`, marginLeft: -1, top: midY, bottom: 0, animationDelay: `${delay + 0.42}s` }}
            />
            {/* solder pads at both junctions */}
            <span
                className={`absolute rounded-full border-2 ${padTone} ${padGlow}`}
                style={{ width: 8, height: 8, left: `${source}%`, marginLeft: -4, top: -4 }}
            />
            <span
                className={`absolute rounded-full border-2 ${padTone} ${padGlow}`}
                style={{ width: 8, height: 8, left: `${target}%`, marginLeft: -4, bottom: -4 }}
            />
            {/* a section name rides ON the run, like a station label, so the
                path is never broken by a heading */}
            {label && (
                <span
                    className="absolute -translate-x-1/2 -translate-y-1/2 px-2 py-0.5 rounded-full glass-chip text-[9px] font-mono uppercase tracking-[0.14em] text-muted-foreground whitespace-nowrap max-w-[86%] overflow-hidden text-ellipsis"
                    style={{ left: "50%", top: midY }}
                >
                    {label}
                </span>
            )}
        </div>
    );
}

function Chip({
    sub,
    state,
    side,
    onOpen,
}: {
    sub: TocSubsection;
    state: NodeState;
    side: "left" | "right";
    onOpen: () => void;
}) {
    const locked = state === "locked";

    // A locked chip is still a button — it routes to the prerequisite
    // diagnostic. Only its LOOK stays dimmed, and the trace feeding it stays
    // dark (see `interactive` below), so the board still reads as a route
    // travelled rather than lighting up wherever the cursor goes.
    const shell =
        state === "completed"
            ? "border-primary/40 shadow-[0_0_20px_-6px_hsl(var(--primary)/0.45)]"
            : state === "active"
              ? // Heavy, theme-tuned glow — see .node-live in index.css.
                "border-primary node-live"
              : locked
                ? "border-border/70 opacity-70"
                : "border-border";

    // The chip powering on under the cursor. Transitions come from the app's
    // global rule, so this needs no transition classes of its own.
    // Locked chips get a restrained version: they lift and clear their dimming,
    // but never take the full power-on glow — that belongs to lessons you've
    // actually reached.
    const hover = locked
        ? "hover:opacity-100 hover:border-primary/50"
        : "hover:-translate-y-[2px] hover:border-primary hover:shadow-[0_0_30px_-4px_hsl(var(--primary)/0.6)] active:translate-y-0";

    // Pins sit on the outward edge, away from the trace, and light with the chip.
    const pinSide = side === "left" ? { left: -3 } : { right: -3 };
    const pinTone = locked ? "bg-border" : "bg-border group-hover:bg-primary";

    return (
        <div
            style={
                side === "left"
                    ? { paddingLeft: `${NODE_INSET}%`, paddingRight: `${100 - NODE_INSET - NODE_WIDTH}%` }
                    : { paddingLeft: `${100 - NODE_INSET - NODE_WIDTH}%`, paddingRight: `${NODE_INSET}%` }
            }
        >
            <button
                type="button"
                onClick={onOpen}
                aria-current={state === "active" ? "step" : undefined}
                aria-label={locked ? `${sub.subsection_title} — locked, take the skip check` : undefined}
                className={`glass-panel relative w-full text-left rounded-xl border px-3 py-2.5 min-h-[62px] flex items-center gap-2 ${shell} ${hover}`}
            >
                {[14, 26, 38].map((top) => (
                    <span
                        key={top}
                        className={`absolute w-[3px] h-[2px] rounded-sm ${pinTone}`}
                        style={{ ...pinSide, top }}
                    />
                ))}

                <span className="flex-1 min-w-0">
                    <span className="block text-[13px] font-semibold leading-snug break-words">
                        {sub.subsection_title}
                    </span>
                    <span className="block text-[9px] font-mono uppercase tracking-wider text-muted-foreground mt-0.5">
                        {SUBSECTION_TYPE_LABEL[sub.subsection_type] ?? sub.subsection_type}
                    </span>
                </span>

                <span className="shrink-0 flex items-center">
                    {state === "completed" && (
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                            <Check className="w-3 h-3" aria-label="Complete" />
                        </span>
                    )}
                    {state === "active" && (
                        <span className="text-[9px] font-bold tracking-widest uppercase text-primary-foreground bg-primary rounded px-1.5 py-0.5">
                            Now
                        </span>
                    )}
                    {locked && <Lock className="w-3.5 h-3.5 text-muted-foreground" aria-label="Locked" />}
                </span>
            </button>
        </div>
    );
}

export default function CircuitBoard({
    sections,
    onOpen,
    currentId,
}: {
    sections: TocSection[];
    /** Fired for every chip, INCLUDING locked ones — a locked lesson leads to
     *  its prerequisite skip check, and the caller decides that. (The uni note
     *  board also renders this component; nothing is ever locked there.) */
    onOpen: (subsectionId: string) => void;
    /** The lesson the student is on — marked "Now". Pass the same one the
     *  page's Continue button targets. */
    currentId?: string | null;
}) {
    const animate = !useReducedMotion();

    // One continuous run of chips. A section name becomes a label on the
    // trace between two chips rather than a row of its own, so the path is
    // never interrupted.
    const nodes = sections.flatMap((sec) =>
        sec.subsections.map((sub, i) => ({
            sub,
            state: stateOf(sub, currentId),
            sectionStart: i === 0 ? `${String(sec.section_number).padStart(2, "0")} · ${sec.section_label}` : null,
        })),
    );

    if (nodes.length === 0) return null;

    return (
        <ol aria-label="Chapter path">
            {nodes.map((node, i) => {
                const side = i % 2 === 0 ? "left" : "right";
                const delay = animate ? Math.min(i * 0.09, 0.8) : 0;
                // A trace is live once the student has reached the chip it
                // leads into, so the path reads as a route travelled.
                const live = node.state === "completed" || node.state === "active";

                return (
                    // `group` lets hovering a chip light the trace that feeds
                    // it — they're siblings inside the same row.
                    <li key={node.sub.subsection_id} className="group">
                        {i > 0 && (
                            <Connector
                                fromLeft={side === "right"}
                                live={live}
                                label={node.sectionStart}
                                interactive={node.state !== "locked"}
                                delay={delay}
                            />
                        )}
                        <motion.div
                            initial={animate ? { opacity: 0, y: 8 } : false}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay, ease: "easeOut" }}
                        >
                            <Chip
                                sub={node.sub}
                                state={node.state}
                                side={side}
                                onOpen={() => onOpen(node.sub.subsection_id)}
                            />
                        </motion.div>
                    </li>
                );
            })}
        </ol>
    );
}
