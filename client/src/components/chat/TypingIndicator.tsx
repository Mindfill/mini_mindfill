import mindfillIcon from "@/assets/mindfill.png";

export default function TypingIndicator() {
    return (
        <div className="flex items-start gap-3 max-w-3xl">
            <img
                src={mindfillIcon}
                alt="TECHCESS"
                className="w-8 h-8 rounded-lg flex-shrink-0 object-cover shadow-lg"
            />
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-5 py-4 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
            </div>
        </div>
    );
}
