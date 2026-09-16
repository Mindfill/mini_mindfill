import { Component, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";

/**
 * Catches render errors so one broken component shows a recoverable panel
 * instead of blanking the whole app. `resetKey` (e.g. the route) clears the
 * error when it changes, so navigating away recovers without a reload.
 *
 * Note: errors thrown from event handlers, timers or animation frames aren't
 * render errors — React never sees them. Those must be caught where they
 * happen.
 */
export default class ErrorBoundary extends Component<
    { children: ReactNode; resetKey?: string; fullScreen?: boolean },
    { error: Error | null }
> {
    state = { error: null as Error | null };

    static getDerivedStateFromError(error: Error) {
        return { error };
    }

    componentDidCatch(error: Error, info: ErrorInfo) {
        console.error("[ErrorBoundary]", error, info.componentStack);
    }

    componentDidUpdate(prev: { resetKey?: string }) {
        if (this.state.error && prev.resetKey !== this.props.resetKey) {
            this.setState({ error: null });
        }
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <div
                className={`${this.props.fullScreen ? "h-[100dvh] bg-background" : "min-h-[60vh]"} w-full flex items-center justify-center px-4`}
            >
                <div className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4" role="alert">
                    <h2 className="text-xl font-semibold">Something went wrong on this page</h2>
                    <p className="text-sm text-muted-foreground">
                        Your progress is saved. Try again, and if it keeps happening, go back and reopen the lesson.
                    </p>
                    <button
                        onClick={() => this.setState({ error: null })}
                        className="min-h-[44px] px-6 rounded-full bg-primary text-primary-foreground font-medium inline-flex items-center gap-2"
                    >
                        <RefreshCw className="w-4 h-4" /> Try again
                    </button>
                </div>
            </div>
        );
    }
}
