import { useEffect, useMemo, useRef, useState } from "react";
import { GlassButton } from "@/components/ui/glass-button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { VizVideo } from "@/components/chat/ChatContent";
import {
    Loader2, Play, RefreshCw, CheckCircle2, EyeOff, Save, AlertTriangle, Film, Clapperboard, Copy, Code2,
    ClipboardPaste,
} from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
    SCENE_TYPES,
    fetchCurriculumVisuals,
    fetchCurriculumVisualStatus,
    renderCurriculumVisual,
    editCurriculumVisualPrompt,
    saveCurriculumVisualCode,
    approveCurriculumVisual,
    unapproveCurriculumVisual,
    reuseCurriculumVisuals,
    ingestCurriculumVisuals,
    type CurriculumVisual,
    type IngestResult,
    type IngestPlanVisual,
    type CurriculumVisualReuseResult,
    type SceneType,
    type VisualApprovalStatus,
} from "@/lib/api";

const POLL_MS = 5000;
const SLOW_POLL_MS = 15000;
const SLOW_AFTER_MS = 2 * 60 * 1000;

const POSITION_LABEL: Record<string, string> = {
    after_analogy: "After analogy",
    after_intuition: "After intuition",
    after_context: "After context",
    after_definitions: "After definitions",
};

const SCENE_LABEL: Record<SceneType, string> = {
    SHAPE_DIAGRAM: "Shape diagram — shapes, flows, mappings",
    GRAPH_PLOT: "Graph plot — curves, slopes, areas",
    NUMBER_LINE: "Number line — intervals, inequalities",
    FORMULA_BREAKDOWN: "Formula breakdown — algebra steps",
    SPATIAL_DIAGRAM: "Spatial diagram — 3D vectors, solids",
};

const APPROVAL_STYLE: Record<VisualApprovalStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    rendered: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
    approved: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

const APPROVAL_LABEL: Record<VisualApprovalStatus, string> = {
    pending: "Not rendered",
    rendered: "Awaiting approval",
    approved: "Live for students",
};

type StatusFilter = "all" | VisualApprovalStatus;

const keyOf = (v: Pick<CurriculumVisual, "subsection_id" | "index">) => `${v.subsection_id}:${v.index}`;

/** Mounts children only once the element has come near the viewport, so a
 * long list doesn't start hundreds of looping videos at once. */
function useNearViewport<T extends Element>() {
    const ref = useRef<T>(null);
    const [near, setNear] = useState(false);
    useEffect(() => {
        const el = ref.current;
        if (!el || near) return;
        const io = new IntersectionObserver(
            (entries) => {
                if (entries.some((e) => e.isIntersecting)) setNear(true);
            },
            { rootMargin: "400px 0px" },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [near]);
    return { ref, near };
}

function VisualCard({
    visual,
    accessToken,
    onChange,
}: {
    visual: CurriculumVisual;
    accessToken: string;
    onChange: (next: CurriculumVisual) => void;
}) {
    const { toast } = useToast();
    const { ref, near } = useNearViewport<HTMLDivElement>();
    const [draft, setDraft] = useState(visual.prompt);
    const [codeDraft, setCodeDraft] = useState(visual.manim_code ?? "");
    const [sceneType, setSceneType] = useState<SceneType | "">(visual.scene_type ?? "");
    const [busy, setBusy] = useState<"save" | "code" | "render" | "approve" | null>(null);

    // Keep the draft in sync when the server copy changes underneath us
    // (e.g. a reload), but never clobber unsaved typing.
    const lastServerPrompt = useRef(visual.prompt);
    useEffect(() => {
        if (visual.prompt !== lastServerPrompt.current) {
            setDraft((d) => (d === lastServerPrompt.current ? visual.prompt : d));
            lastServerPrompt.current = visual.prompt;
        }
    }, [visual.prompt]);

    const serverCode = visual.manim_code ?? "";
    const lastServerCode = useRef(serverCode);
    useEffect(() => {
        if (serverCode !== lastServerCode.current) {
            setCodeDraft((c) => (c === lastServerCode.current ? serverCode : c));
            lastServerCode.current = serverCode;
        }
    }, [serverCode]);

    const rendering = visual.render_status === "rendering";
    const promptDirty = draft.trim() !== visual.prompt.trim();
    const codeDirty = codeDraft.trim() !== serverCode.trim();
    // What the next Render will actually send to the renderer.
    const usesOwnCode = serverCode.trim().length > 0;

    // Poll while this visual renders; stop on success/failure or unmount.
    const onChangeRef = useRef(onChange);
    onChangeRef.current = onChange;
    useEffect(() => {
        if (!rendering) return;
        let cancelled = false;
        let timer: ReturnType<typeof setTimeout>;
        const startedAt = Date.now();
        const tick = async () => {
            try {
                const fresh = await fetchCurriculumVisualStatus(visual.subsection_id, visual.index, accessToken);
                if (cancelled) return;
                onChangeRef.current(fresh);
                if (fresh.render_status !== "rendering") return;
            } catch {
                // transient — keep polling
            }
            if (!cancelled) timer = setTimeout(tick, Date.now() - startedAt > SLOW_AFTER_MS ? SLOW_POLL_MS : POLL_MS);
        };
        timer = setTimeout(tick, POLL_MS);
        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
    }, [rendering, visual.subsection_id, visual.index, accessToken]);

    const run = async (kind: "save" | "code" | "render" | "approve", action: () => Promise<unknown>, success?: { title: string; description?: string }) => {
        setBusy(kind);
        try {
            await action();
            // The mutation endpoints return the raw prompt entry; the status
            // endpoint returns the full row shape the list uses.
            onChange(await fetchCurriculumVisualStatus(visual.subsection_id, visual.index, accessToken));
            if (success) toast(success);
        } catch (err) {
            toast({ variant: "destructive", title: err instanceof Error ? err.message : "Something went wrong" });
        } finally {
            setBusy(null);
        }
    };

    const savePrompt = () =>
        run("save", () => editCurriculumVisualPrompt(visual.subsection_id, visual.index, draft.trim(), accessToken), {
            title: "Prompt saved",
            description: "Copy the new text into the workbook too, or the next import restores the old prompt.",
        });

    const saveCode = () =>
        run("code", () => saveCurriculumVisualCode(visual.subsection_id, visual.index, codeDraft.trim(), accessToken), {
            title: codeDraft.trim() ? "Code saved" : "Code cleared",
            description: codeDraft.trim()
                ? "Render now sends this code straight to the renderer."
                : "Render generates code from the prompt again.",
        });

    const startRender = () => {
        if (!sceneType) return;
        run("render", () => renderCurriculumVisual(visual.subsection_id, visual.index, sceneType, accessToken));
    };

    const toggleApproval = () =>
        run(
            "approve",
            () =>
                visual.approval_status === "approved"
                    ? unapproveCurriculumVisual(visual.subsection_id, visual.index, accessToken)
                    : approveCurriculumVisual(visual.subsection_id, visual.index, accessToken),
        );

    return (
        <div ref={ref} className="glass-panel rounded-2xl p-4 md:p-5 space-y-4" data-testid={`visual-${keyOf(visual)}`}>
            <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">#{visual.index}</span>
                {visual.position && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full glass-chip">
                        {POSITION_LABEL[visual.position] ?? visual.position}
                    </span>
                )}
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${APPROVAL_STYLE[visual.approval_status]}`}>
                    {APPROVAL_LABEL[visual.approval_status]}
                </span>
                {visual.render_attempts > 0 && (
                    <span className="text-xs text-muted-foreground ml-auto">
                        {visual.render_attempts} render{visual.render_attempts === 1 ? "" : "s"}
                    </span>
                )}
            </div>

            <div className="grid md:grid-cols-2 gap-4">
                {/* Left: prompt + render controls */}
                <div className="space-y-3 min-w-0">
                    <div className="space-y-1.5">
                        <Label htmlFor={`prompt-${keyOf(visual)}`}>Prompt</Label>
                        <Textarea
                            id={`prompt-${keyOf(visual)}`}
                            value={draft}
                            onChange={(e) => setDraft(e.target.value)}
                            rows={6}
                            maxLength={4000}
                            className="text-sm leading-relaxed resize-y"
                        />
                        {promptDirty && (
                            <div className="flex flex-wrap items-center gap-3">
                                <GlassButton
                                    size="sm"
                                    onClick={savePrompt}
                                    disabled={busy !== null || !draft.trim()}
                                    contentClassName="flex items-center gap-1.5"
                                >
                                    {busy === "save" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Save prompt
                                </GlassButton>
                                <button
                                    type="button"
                                    onClick={() => setDraft(visual.prompt)}
                                    className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] px-2"
                                >
                                    Discard
                                </button>
                                <p className="text-xs text-muted-foreground w-full">
                                    {visual.approval_status === "approved"
                                        ? "Saving takes this visual away from students until you render and approve it again."
                                        : "Saving discards the current render."}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor={`code-${keyOf(visual)}`} className="flex items-center gap-1.5">
                            <Code2 className="w-3.5 h-3.5" /> Manim code <span className="text-muted-foreground font-normal">(optional)</span>
                        </Label>
                        <Textarea
                            id={`code-${keyOf(visual)}`}
                            value={codeDraft}
                            onChange={(e) => setCodeDraft(e.target.value)}
                            rows={codeDraft ? 12 : 4}
                            maxLength={20000}
                            spellCheck={false}
                            placeholder={"Leave empty to generate the code from the prompt.\n\nPaste a scene whose class is TechcessScene to render it as-is."}
                            className="text-xs leading-snug resize-y font-mono"
                        />
                        <p className="text-xs text-muted-foreground">
                            {usesOwnCode
                                ? "Render sends this code straight to the renderer — nothing is generated."
                                : "Empty: Render generates the code from the prompt."}
                        </p>
                        {codeDirty && (
                            <div className="flex flex-wrap items-center gap-3">
                                <GlassButton
                                    size="sm"
                                    onClick={saveCode}
                                    disabled={busy !== null}
                                    contentClassName="flex items-center gap-1.5"
                                >
                                    {busy === "code" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    {codeDraft.trim() ? "Save code" : "Clear code"}
                                </GlassButton>
                                <button
                                    type="button"
                                    onClick={() => setCodeDraft(serverCode)}
                                    className="text-xs text-muted-foreground hover:text-foreground min-h-[44px] px-2"
                                >
                                    Discard
                                </button>
                                <p className="text-xs text-muted-foreground w-full">
                                    {visual.approval_status === "approved"
                                        ? "Saving takes this visual away from students until you render and approve it again."
                                        : "Saving discards the current render."}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="space-y-1.5">
                        <Label htmlFor={`scene-${keyOf(visual)}`}>Scene type</Label>
                        <select
                            id={`scene-${keyOf(visual)}`}
                            value={sceneType}
                            onChange={(e) => setSceneType(e.target.value as SceneType)}
                            disabled={rendering}
                            className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="" disabled>Choose a scene type…</option>
                            {SCENE_TYPES.map((t) => (
                                <option key={t} value={t}>{SCENE_LABEL[t]}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <GlassButton
                            size="sm"
                            onClick={startRender}
                            disabled={!sceneType || rendering || promptDirty || codeDirty || busy !== null}
                            contentClassName="flex items-center gap-1.5"
                        >
                            {busy === "render" || rendering ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : visual.storage_url ? (
                                <RefreshCw className="w-3.5 h-3.5" />
                            ) : (
                                <Play className="w-3.5 h-3.5" />
                            )}
                            {rendering ? "Rendering…" : visual.storage_url ? "Render again" : "Render"}
                        </GlassButton>

                        {(visual.approval_status === "rendered" || visual.approval_status === "approved") && (
                            <GlassButton
                                size="sm"
                                onClick={toggleApproval}
                                disabled={busy !== null || (rendering && visual.approval_status !== "approved")}
                                contentClassName="flex items-center gap-1.5"
                            >
                                {busy === "approve" ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : visual.approval_status === "approved" ? (
                                    <EyeOff className="w-3.5 h-3.5" />
                                ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                {visual.approval_status === "approved" ? "Unapprove" : "Approve"}
                            </GlassButton>
                        )}
                    </div>

                    {(promptDirty || codeDirty) && !rendering && (
                        <p className="text-xs text-muted-foreground">
                            Save or discard your {promptDirty && codeDirty ? "edits" : promptDirty ? "prompt edit" : "code edit"} before rendering.
                        </p>
                    )}
                    {rendering && (
                        <p className="text-xs text-muted-foreground">
                            Rendering usually takes 1–2 minutes.{" "}
                            {usesOwnCode
                                ? "Your own code is never rewritten, so a failure comes back with its error for you to fix."
                                : "Failed renders retry automatically."}
                            {visual.approval_status === "approved" && " Students keep the current video until you approve the new one."}
                        </p>
                    )}
                    {visual.render_status === "failed" && visual.render_error && (
                        <details className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                            <summary className="text-xs font-medium text-red-700 dark:text-red-400 cursor-pointer flex items-center gap-1.5 min-h-[28px]">
                                <AlertTriangle className="w-3.5 h-3.5" /> Last render failed — show error
                            </summary>
                            <pre className="mt-2 text-[11px] leading-snug whitespace-pre-wrap break-words max-h-60 overflow-y-auto font-mono text-muted-foreground">
                                {visual.render_error}
                            </pre>
                        </details>
                    )}
                </div>

                {/* Right: preview */}
                <div className="min-w-0">
                    {visual.storage_url ? (
                        near ? (
                            <VizVideo url={visual.storage_url} />
                        ) : (
                            <div className="rounded-2xl border border-border bg-muted/40 aspect-video w-full" />
                        )
                    ) : (
                        <div className="rounded-2xl border border-dashed border-border bg-muted/20 aspect-video w-full flex flex-col items-center justify-center gap-2 text-muted-foreground">
                            {rendering ? <Loader2 className="w-5 h-5 animate-spin" /> : <Film className="w-5 h-5" />}
                            <span className="text-xs">{rendering ? "Rendering…" : "No render yet"}</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

const PLACEMENT_NOTE: Record<IngestPlanVisual["placement"], string> = {
    marker: "placed by a [VISUAL] marker",
    position: "placed by its position",
    bare_marker: "may be picked up by a bare [VISUAL] marker",
    end: "at the end of the lesson",
};

/** Paste a batch of authored visuals (prompt + scene type + Manim code).
 * Always checks first: an ingest can discard renders and unpublish live
 * visuals, so nothing is written until the plan has been read. */
function IngestDialog({
    accessToken,
    open,
    onOpenChange,
    onApplied,
}: {
    accessToken: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onApplied: () => void;
}) {
    const { toast } = useToast();
    const [text, setText] = useState("");
    const [plan, setPlan] = useState<IngestResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [busy, setBusy] = useState<"check" | "apply" | null>(null);

    const reset = () => {
        setText("");
        setPlan(null);
        setError(null);
    };

    const check = async () => {
        setBusy("check");
        setError(null);
        try {
            setPlan(await ingestCurriculumVisuals(text, accessToken, { dryRun: true }));
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't read the paste");
        } finally {
            setBusy(null);
        }
    };

    const apply = async () => {
        setBusy("apply");
        try {
            const result = await ingestCurriculumVisuals(text, accessToken, { dryRun: false });
            toast({
                title: `Ingested ${result.applied} visual${result.applied === 1 ? "" : "s"}`,
                description: "Paste each workbook cell back into the workbook, or the next import reverts these.",
            });
            reset();
            onOpenChange(false);
            onApplied();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Couldn't apply the paste");
        } finally {
            setBusy(null);
        }
    };

    const totals = plan
        ? {
              creates: plan.subsections.reduce((n, s) => n + s.creates, 0),
              updates: plan.subsections.reduce((n, s) => n + s.updates, 0),
              discards: plan.subsections.reduce((n, s) => n + s.visuals.filter((v) => v.discards_render).length, 0),
              unpublishes: plan.subsections.reduce((n, s) => n + s.visuals.filter((v) => v.unpublishes).length, 0),
              warnings: plan.subsections.reduce((n, s) => n + s.visuals.filter((v) => v.warning).length, 0),
          }
        : null;

    return (
        <AlertDialog
            open={open}
            onOpenChange={(next) => {
                if (!next) reset();
                onOpenChange(next);
            }}
        >
            <AlertDialogContent className="max-w-3xl">
                <AlertDialogHeader>
                    <AlertDialogTitle>{plan ? "Check before applying" : "Paste authored visuals"}</AlertDialogTitle>
                    <AlertDialogDescription>
                        {plan
                            ? "Nothing has been written yet. Entries you didn't paste are never touched."
                            : "One ===VISUAL=== block per visual, each keyed by its subsection slug and index. Code is optional — leave it out to generate from the prompt."}
                    </AlertDialogDescription>
                </AlertDialogHeader>

                {error && (
                    <div className="rounded-xl border border-red-500/30 bg-red-500/5 p-3">
                        <p className="text-xs text-red-700 dark:text-red-400 whitespace-pre-wrap break-words">{error}</p>
                    </div>
                )}

                {!plan ? (
                    <Textarea
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        rows={16}
                        spellCheck={false}
                        placeholder={"===BATCH: 2===\n\n===VISUAL===\nsubsection_id: ss1-math-ch01-s6-02\nindex: 1\nscene_type: GRAPH_PLOT\nposition: after_intuition\n---PROMPT---\nWhat the figure shows.\n---CODE---\nfrom manim import *\n\nclass TechcessScene(Scene):\n    def construct(self):\n        ...\n===END VISUAL==="}
                        className="text-xs leading-snug font-mono resize-y"
                    />
                ) : (
                    <div className="space-y-3">
                        <div className="flex flex-wrap gap-2 text-xs">
                            <span className="px-2.5 py-1 rounded-full glass-chip">{plan.parsed} parsed</span>
                            <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
                                {totals!.creates} new
                            </span>
                            <span className="px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400">
                                {totals!.updates} updated
                            </span>
                            {plan.rejections.length > 0 && (
                                <span className="px-2.5 py-1 rounded-full bg-red-500/10 text-red-700 dark:text-red-400">
                                    {plan.rejections.length} rejected
                                </span>
                            )}
                        </div>

                        {totals!.unpublishes > 0 && (
                            <p className="text-xs text-red-700 dark:text-red-400 flex items-start gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                {totals!.unpublishes} visual{totals!.unpublishes === 1 ? " is" : "s are"} live for students
                                right now — applying this pulls {totals!.unpublishes === 1 ? "it" : "them"} until re-rendered
                                and approved.
                            </p>
                        )}
                        {totals!.discards > totals!.unpublishes && (
                            <p className="text-xs text-amber-700 dark:text-amber-400">
                                {totals!.discards} existing render{totals!.discards === 1 ? "" : "s"} will be discarded.
                            </p>
                        )}
                        {totals!.warnings > 0 && (
                            <p className="text-xs text-muted-foreground">
                                {totals!.warnings} visual{totals!.warnings === 1 ? "" : "s"} have no [VISUAL] marker or no
                                usable position — see the notes below.
                            </p>
                        )}

                        {plan.rejections.length > 0 && (
                            <div className="rounded-xl border border-red-500/30 bg-red-500/5 divide-y divide-red-500/20 max-h-40 overflow-y-auto">
                                {plan.rejections.map((r, i) => (
                                    <p key={i} className="p-2.5 text-xs text-red-700 dark:text-red-400 break-words">
                                        <span className="font-mono">line {r.line}</span>
                                        {r.subsection_id && <span className="font-mono"> · {r.subsection_id}{r.index ? ` #${r.index}` : ""}</span>}
                                        {" — "}
                                        {r.error}
                                    </p>
                                ))}
                            </div>
                        )}

                        <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border">
                            {plan.subsections.map((s) => (
                                <div key={s.subsection_slug} className="p-3 space-y-2">
                                    <div className="flex items-baseline justify-between gap-3">
                                        <span className="text-sm font-medium break-all">
                                            {s.subsection_title ?? s.subsection_slug}
                                            <span className="text-muted-foreground font-normal"> · {s.subsection_slug}</span>
                                        </span>
                                        <span className="shrink-0 text-xs text-muted-foreground">
                                            {s.creates} new · {s.updates} updated
                                        </span>
                                    </div>
                                    {s.visuals.map((v) => (
                                        <div key={v.index} className="text-xs text-muted-foreground flex flex-wrap items-baseline gap-x-2">
                                            <span className="font-mono text-foreground">#{v.index}</span>
                                            <span>{v.action === "create" ? "new" : "updated"}</span>
                                            <span>· {v.scene_type}</span>
                                            <span>· {v.has_code ? "own code" : "from prompt"}</span>
                                            <span>· {PLACEMENT_NOTE[v.placement]}</span>
                                            {v.unpublishes && (
                                                <span className="text-red-700 dark:text-red-400">· unpublishes a live visual</span>
                                            )}
                                            {!v.unpublishes && v.discards_render && (
                                                <span className="text-amber-700 dark:text-amber-400">· discards its render</span>
                                            )}
                                            {v.warning && <span className="w-full text-muted-foreground/80">{v.warning}</span>}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            navigator.clipboard?.writeText(s.workbook_cell);
                                            toast({ title: "Workbook cell copied", description: `Paste it into manim_prompts for ${s.subsection_slug}.` });
                                        }}
                                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 min-h-[36px]"
                                    >
                                        <Copy className="w-3.5 h-3.5" /> Copy workbook cell
                                    </button>
                                </div>
                            ))}
                        </div>

                        <p className="text-xs text-muted-foreground">
                            The workbook stays the source of truth: copy each cell into its subsection's
                            <span className="font-mono"> manim_prompts</span> column, or the next import reverts these
                            prompts and drops the code with them.
                        </p>
                    </div>
                )}

                <AlertDialogFooter>
                    {plan ? (
                        <>
                            <button
                                type="button"
                                onClick={() => setPlan(null)}
                                disabled={busy !== null}
                                className="text-sm text-muted-foreground hover:text-foreground min-h-[44px] px-3 mr-auto"
                            >
                                Back to the paste
                            </button>
                            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    apply();
                                }}
                                disabled={busy !== null || plan.subsections.length === 0}
                            >
                                {busy === "apply" ? "Applying…" : `Apply ${totals!.creates + totals!.updates}`}
                            </AlertDialogAction>
                        </>
                    ) : (
                        <>
                            <AlertDialogCancel disabled={busy !== null}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                                onClick={(e) => {
                                    e.preventDefault();
                                    check();
                                }}
                                disabled={busy !== null || !text.trim()}
                            >
                                {busy === "check" ? "Checking…" : "Check paste"}
                            </AlertDialogAction>
                        </>
                    )}
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}

export default function CurriculumVisualsPanel({ accessToken }: { accessToken: string }) {
    const { toast } = useToast();
    const [visuals, setVisuals] = useState<CurriculumVisual[]>([]);
    const [loading, setLoading] = useState(true);
    const [chapterId, setChapterId] = useState<string>("all");
    const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

    const load = async () => {
        setLoading(true);
        try {
            setVisuals(await fetchCurriculumVisuals(accessToken));
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't load visuals" });
        } finally {
            setLoading(false);
        }
    };

    // Reuse runs in two steps: a dry run that writes nothing and lists what
    // would be adopted, then the real sweep once it's confirmed. One request
    // does every match, so this is a single click however many there are.
    const [reuseBusy, setReuseBusy] = useState(false);
    const [reusePlan, setReusePlan] = useState<CurriculumVisualReuseResult | null>(null);
    const [ingestOpen, setIngestOpen] = useState(false);

    const previewReuse = async () => {
        setReuseBusy(true);
        try {
            const plan = await reuseCurriculumVisuals(accessToken, {
                dryRun: true,
                chapterId: chapterId === "all" ? null : chapterId,
            });
            if (plan.matched === 0) {
                toast({
                    title: "Nothing to reuse",
                    description: "No unrendered visual shares a prompt with one that's already rendered.",
                });
                return;
            }
            setReusePlan(plan);
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't check for reusable visuals" });
        } finally {
            setReuseBusy(false);
        }
    };

    const confirmReuse = async () => {
        setReuseBusy(true);
        try {
            const result = await reuseCurriculumVisuals(accessToken, {
                dryRun: false,
                chapterId: chapterId === "all" ? null : chapterId,
            });
            setReusePlan(null);
            toast({
                title: `Reused ${result.applied} visual${result.applied === 1 ? "" : "s"}`,
                description: "They keep the approval they had where they were first rendered.",
            });
            await load();
        } catch (err) {
            console.error(err);
            toast({ variant: "destructive", title: "Couldn't reuse visuals" });
        } finally {
            setReuseBusy(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Visuals changed since the filter was picked stay visible even if they no
    // longer match it — otherwise a card vanishes the moment its render lands.
    const [touched, setTouched] = useState<Set<string>>(new Set());
    useEffect(() => setTouched(new Set()), [statusFilter, chapterId]);

    const updateVisual = (next: CurriculumVisual) => {
        setVisuals((prev) => prev.map((v) => (keyOf(v) === keyOf(next) ? next : v)));
        setTouched((prev) => (prev.has(keyOf(next)) ? prev : new Set(prev).add(keyOf(next))));
    };

    const chapters = useMemo(() => {
        const seen = new Map<string, { id: string; label: string }>();
        for (const v of visuals) {
            if (v.chapter_id && !seen.has(v.chapter_id)) {
                const num = v.chapter_number !== null ? `Ch ${String(v.chapter_number).padStart(2, "0")} · ` : "";
                seen.set(v.chapter_id, { id: v.chapter_id, label: `${num}${v.chapter_title ?? "Untitled chapter"}` });
            }
        }
        return Array.from(seen.values());
    }, [visuals]);

    const inChapter = useMemo(
        () => (chapterId === "all" ? visuals : visuals.filter((v) => v.chapter_id === chapterId)),
        [visuals, chapterId],
    );

    const counts = useMemo(() => {
        const c = { all: inChapter.length, pending: 0, rendered: 0, approved: 0 };
        for (const v of inChapter) c[v.approval_status] += 1;
        return c;
    }, [inChapter]);

    const shown =
        statusFilter === "all"
            ? inChapter
            : inChapter.filter((v) => v.approval_status === statusFilter || touched.has(keyOf(v)));

    // Group consecutive visuals by subsection (the list is already in lesson order).
    const groups = useMemo(() => {
        const out: { subsectionId: string; header: CurriculumVisual; items: CurriculumVisual[] }[] = [];
        for (const v of shown) {
            const last = out[out.length - 1];
            if (last && last.subsectionId === v.subsection_id) last.items.push(v);
            else out.push({ subsectionId: v.subsection_id, header: v, items: [v] });
        }
        return out;
    }, [shown]);

    const STATUS_TABS: { id: StatusFilter; label: string }[] = [
        { id: "all", label: "All" },
        { id: "pending", label: "Not rendered" },
        { id: "rendered", label: "Awaiting approval" },
        { id: "approved", label: "Live" },
    ];

    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
                <div>
                    <h3 className="font-semibold flex items-center gap-2"><Clapperboard className="w-4 h-4" /> Static visuals</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                        Every visual authored in the imported workbook, in lesson order. Pick a scene type and render;
                        edit the prompt and render again until it's right, then approve. Only approved visuals appear
                        in lessons, at the position set in the workbook. To render a scene you wrote yourself, paste it
                        into a visual's Manim code box — that code is rendered as-is and nothing is generated.
                    </p>
                </div>

                <div className="flex flex-col md:flex-row gap-3 md:items-end">
                    <div className="space-y-1.5 md:w-72">
                        <Label htmlFor="visuals-chapter">Chapter</Label>
                        <select
                            id="visuals-chapter"
                            value={chapterId}
                            onChange={(e) => setChapterId(e.target.value)}
                            className="w-full min-h-[44px] rounded-md border border-input bg-background px-3 text-sm"
                        >
                            <option value="all">All chapters</option>
                            {chapters.map((c) => (
                                <option key={c.id} value={c.id}>{c.label}</option>
                            ))}
                        </select>
                    </div>
                    <div className="flex items-center gap-4 md:ml-auto">
                        <button
                            type="button"
                            onClick={() => setIngestOpen(true)}
                            title="Paste a batch of authored visuals — prompt, scene type and optional Manim code — instead of typing them in one by one"
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 min-h-[44px]"
                        >
                            <ClipboardPaste className="w-4 h-4" /> Paste visuals
                        </button>
                        <button
                            type="button"
                            onClick={previewReuse}
                            disabled={loading || reuseBusy}
                            title="Adopt an already-rendered video onto any visual whose prompt is identical, instead of rendering it again"
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 min-h-[44px] disabled:opacity-50"
                        >
                            <Copy className={`w-4 h-4 ${reuseBusy ? "animate-pulse" : ""}`} /> Reuse rendered visuals
                        </button>
                        <button
                            type="button"
                            onClick={load}
                            disabled={loading}
                            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1.5 min-h-[44px]"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Refresh
                        </button>
                    </div>
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1" role="tablist" aria-label="Filter by status">
                    {STATUS_TABS.map((t) => (
                        <button
                            key={t.id}
                            role="tab"
                            aria-selected={statusFilter === t.id}
                            onClick={() => setStatusFilter(t.id)}
                            className={`shrink-0 min-h-[44px] px-4 rounded-full text-sm font-medium transition-colors ${
                                statusFilter === t.id ? "bg-primary text-primary-foreground" : "glass-chip text-muted-foreground hover:text-foreground"
                            }`}
                        >
                            {t.label} <span className="opacity-70">{counts[t.id]}</span>
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            ) : visuals.length === 0 ? (
                <p className="text-muted-foreground text-sm">No visuals yet — import a workbook with manim prompts first.</p>
            ) : groups.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nothing matches this filter.</p>
            ) : (
                <div className="space-y-8">
                    {groups.map((g) => (
                        <section key={g.subsectionId} className="space-y-3">
                            <div>
                                <p className="text-xs text-muted-foreground uppercase tracking-wider">
                                    {g.header.chapter_number !== null && `Ch ${String(g.header.chapter_number).padStart(2, "0")} · `}
                                    {g.header.section_label ?? ""}
                                </p>
                                <h4 className="font-semibold">
                                    {g.header.subsection_title ?? g.header.subsection_slug}
                                    {g.header.subsection_status && g.header.subsection_status !== "active" && (
                                        <span className="ml-2 text-xs font-normal text-muted-foreground">({g.header.subsection_status})</span>
                                    )}
                                </h4>
                            </div>
                            {g.items.map((v) => (
                                <VisualCard key={keyOf(v)} visual={v} accessToken={accessToken} onChange={updateVisual} />
                            ))}
                        </section>
                    ))}
                </div>
            )}

            <IngestDialog
                accessToken={accessToken}
                open={ingestOpen}
                onOpenChange={setIngestOpen}
                onApplied={load}
            />

            <AlertDialog open={reusePlan !== null} onOpenChange={(open) => !open && setReusePlan(null)}>
                <AlertDialogContent className="max-w-2xl">
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            Reuse {reusePlan?.matched} already-rendered visual{reusePlan?.matched === 1 ? "" : "s"}?
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            Each of these is authored with a prompt identical to one that has already been
                            rendered, so it can use that video instead of being rendered again. Each keeps the
                            approval it had where it was first rendered, so approved ones go live with their
                            chapter — use Unapprove on any you want to look at again. Nothing is rendered and
                            nothing is charged.
                        </AlertDialogDescription>
                    </AlertDialogHeader>

                    <div className="max-h-72 overflow-y-auto rounded-xl border border-border divide-y divide-border text-sm">
                        {reusePlan?.visuals.map((v) => (
                            <div key={`${v.subsection_id}-${v.index}`} className="p-3 space-y-1">
                                <div className="flex items-baseline justify-between gap-3">
                                    <span className="font-medium break-all">
                                        {v.subsection_slug} <span className="text-muted-foreground">#{v.index}</span>
                                    </span>
                                    <span
                                        className={`shrink-0 text-xs ${
                                            v.approval_status === "approved"
                                                ? "text-green-700 dark:text-green-400"
                                                : "text-amber-700 dark:text-amber-400"
                                        }`}
                                    >
                                        {v.approval_status === "approved" ? "goes live" : "needs approval"}
                                    </span>
                                </div>
                                <p className="text-xs text-muted-foreground break-all">
                                    reuses the video from {v.from_subsection_slug}
                                </p>
                            </div>
                        ))}
                    </div>

                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={reuseBusy}>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={(e) => {
                                e.preventDefault(); // keep the dialog open until the sweep finishes
                                confirmReuse();
                            }}
                            disabled={reuseBusy}
                        >
                            {reuseBusy ? "Reusing…" : `Reuse ${reusePlan?.matched}`}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
