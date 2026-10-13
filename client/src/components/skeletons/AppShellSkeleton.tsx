import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import AppSidebar from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import {
    ChatSkeleton,
    ContentSkeleton,
    CoursesSkeleton,
    DashboardSkeleton,
    NotesSkeleton,
    ProfileSkeleton,
} from "./PageSkeletons";
import type { ShellView } from "@/lib/appShell";

const ACTIVE_ITEM: Record<ShellView, "home" | "courses" | "notes" | "profile"> = {
    home: "home",
    courses: "courses",
    notes: "notes",
    profile: "profile",
    lesson: "courses",
    "note-lesson": "notes",
    note: "notes",
};

/**
 * The same frame every university page renders (gradient + sidebar +
 * content area), with that page's skeleton in the content area. App's route
 * fallback shows this while a page's chunk is still downloading, so the
 * sidebar stays on screen. See lib/appShell.ts.
 */
export default function AppShellSkeleton({ view }: { view: ShellView }) {
    const { user, signOut } = useAuth();
    const { fullName } = useUserProfile();
    const [, navigate] = useLocation();
    const userName = fullName || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "";

    const handleSignOut = async () => {
        await signOut();
        navigate("/login");
    };

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar userName={userName} activeItem={ACTIVE_ITEM[view]} onSignOut={handleSignOut} />
            <div className="flex-1 min-w-0 flex flex-col overflow-y-auto relative">
                {view === "home" && <DashboardSkeleton />}
                {view === "courses" && <CoursesSkeleton />}
                {view === "notes" && <NotesSkeleton />}
                {view === "profile" && <ProfileSkeleton />}
                {(view === "lesson" || view === "note-lesson") && <ChatSkeleton />}
                {view === "note" && <ContentSkeleton label="Loading your note" />}
            </div>
        </div>
    );
}
