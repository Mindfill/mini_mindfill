import { createContext, useContext, type ReactNode } from "react";
import { useLocation } from "wouter";
import TechcessLoader from "@/components/brand/TechcessLoader";
import { useActivityHeartbeat } from "@/hooks/use-activity-heartbeat";
import { SecondaryApiError } from "@/lib/secondaryApi";
import { Lock, WifiOff, Smartphone } from "lucide-react";

/**
 * The sidebar, gradient, scroll container and auth/profile guards live in
 * SecondaryLayout, which stays mounted across every /secondary/* page — so
 * moving between pages never re-mounts the chrome or re-runs the guards.
 * Pages read what they need from this context.
 */
export interface SecondaryShellContext {
    accessToken: string;
}

export const ShellContext = createContext<SecondaryShellContext | null>(null);

export function useSecondaryShell(): SecondaryShellContext {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error("useSecondaryShell must be used inside SecondaryLayout");
    return ctx;
}

/** Page wrapper. `trackActivity` mounts the study-time heartbeat — only on
 * pages where the student is actually learning (subsections). */
export default function SecondaryShell({
    children,
    trackActivity = false,
}: {
    children: (ctx: SecondaryShellContext) => ReactNode;
    trackActivity?: boolean;
}) {
    const ctx = useSecondaryShell();
    useActivityHeartbeat(trackActivity ? ctx.accessToken : undefined);
    return <>{children(ctx)}</>;
}

/** In-page loading state (kept under its old name for existing imports). */
export function PageSkeleton() {
    return <TechcessLoader />;
}

/** Friendly full-page state for the access errors every lesson endpoint can return. */
export function AccessErrorState({
    error,
    onRetry,
    diagnosticFor,
}: {
    error: unknown;
    onRetry?: () => void;
    /** Subsection id. When given, a "locked" error offers the prerequisite
     *  skip check instead of just sending the student back. */
    diagnosticFor?: string;
}) {
    const [, navigate] = useLocation();
    const e = error instanceof SecondaryApiError ? error : null;

    let icon = <WifiOff className="w-6 h-6" />;
    let title = "Couldn't load this page";
    let body = "Check your connection and try again.";
    let action: ReactNode = onRetry ? (
        <button onClick={onRetry} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
            Try again
        </button>
    ) : null;

    if (e?.status === 402 || e?.reason === "subscription_required") {
        icon = <Lock className="w-6 h-6" />;
        title = "This chapter is part of the full course";
        body = "Chapter 0 is free. Subscribe to unlock every chapter.";
        action = (
            <button onClick={() => navigate("/upgrade")} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                See plans
            </button>
        );
    } else if (e?.status === 403 && e.reason === "locked") {
        icon = <Lock className="w-6 h-6" />;
        title = "Not unlocked yet";
        body = diagnosticFor
            ? "Do the lessons before this one — or prove you don't need them."
            : "Finish the lessons before this one to open it.";
        action = diagnosticFor ? (
            <div className="flex flex-col gap-2">
                <button
                    onClick={() => navigate(`/secondary/diagnostic/${diagnosticFor}`)}
                    className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium"
                >
                    Take the skip check
                </button>
                <button
                    onClick={() => navigate("/secondary/learn")}
                    className="min-h-[44px] px-6 rounded-full glass-chip font-medium"
                >
                    Back to chapters
                </button>
            </div>
        ) : (
            <button onClick={() => navigate("/secondary/learn")} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                Back to chapters
            </button>
        );
    } else if (e?.status === 403) {
        icon = <Smartphone className="w-6 h-6" />;
        title = "This device isn't registered";
        body = "Your plan is in use on too many devices. Remove one from your profile to continue here.";
        action = (
            <button onClick={() => navigate("/profile")} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                Manage devices
            </button>
        );
    } else if (e?.status === 404) {
        title = "Lesson not found";
        body = "It may have been moved or isn't available yet.";
        action = (
            <button onClick={() => navigate("/secondary/learn")} className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium">
                Back to chapters
            </button>
        );
    }

    return (
        <div className="flex items-center justify-center px-4 py-16">
            <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4" role="alert">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">{icon}</div>
                <h2 className="text-xl font-semibold">{title}</h2>
                <p className="text-muted-foreground text-sm">{body}</p>
                {action}
            </div>
        </div>
    );
}
