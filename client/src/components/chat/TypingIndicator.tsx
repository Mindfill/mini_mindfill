export default function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 max-w-3xl">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center flex-shrink-0">
                <span className="text-[10px] font-black italic text-white">T</span>
            </div>
            <div className="bg-white/5 border border-white/5 rounded-2xl rounded-tl-sm px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}
