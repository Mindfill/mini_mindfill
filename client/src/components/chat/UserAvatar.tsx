import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";

/** The student's side of the chat: their initial, styled like the sidebar's
 *  profile badge so it reads as "you" next to the tutor's mascot. */
export default function UserAvatar() {
    const { user } = useAuth();
    const { fullName } = useUserProfile();
    const name = fullName || user?.user_metadata?.full_name || user?.email || "";
    const initial = name.trim().charAt(0).toUpperCase() || "?";

    return (
        <div
            className="w-8 h-8 rounded-full flex-shrink-0 bg-primary/20 text-primary text-sm font-bold flex items-center justify-center"
            role="img"
            aria-label="You"
        >
            {initial}
        </div>
    );
}
