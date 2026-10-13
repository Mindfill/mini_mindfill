import TechcessBot from "@/components/brand/TechcessBot";

/** The tutor's chat avatar: the mascot's head on a soft tile. It only moves
 *  while `thinking` (the typing indicator). */
export default function TutorAvatar({ thinking = false }: { thinking?: boolean }) {
    return (
        <div className="w-8 h-8 rounded-lg flex-shrink-0 bg-primary/10 flex items-center justify-center" role="img" aria-label="TECHCESS tutor">
            <TechcessBot headOnly mood={thinking ? "thinking" : "idle"} animated={thinking} size={28} />
        </div>
    );
}
