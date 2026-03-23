export default function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-primary">M</span>
            </div>
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4">
                <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}
