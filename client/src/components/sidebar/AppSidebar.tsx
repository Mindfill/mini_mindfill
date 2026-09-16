import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Home, BookOpen, LogOut, Menu, X, FileText, GraduationCap } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Button } from "@/components/ui/button";
import { DropReviewDialog } from "./DropReviewDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { DyslexiaToggle } from "@/components/DyslexiaToggle";
import { CreditsDisplay } from "@/components/CreditsDisplay";
import mindfillLogo from "@/assets/mindfill.png";
import type { UserType, UserRole } from "@/lib/api";

type Variant = "university" | "secondary" | "parent" | "school_admin";

interface AppSidebarProps {
    userName: string;
    activeItem: "home" | "courses" | "notes" | "learn" | "profile";
    onSignOut: () => void;
    /** Which nav items to show — the uni-specific ones (Courses/Notes) must
     * never appear for secondary/parent/school_admin accounts. Optional: when
     * omitted the variant is derived from the signed-in user's profile, so a
     * call site that forgets the prop can't leak uni nav items. Pass it
     * explicitly on pages that know their variant up front — that avoids a
     * brief "university" flash while the profile is still loading. */
    variant?: Variant;
}

type SidebarNavItem = {
    icon: React.ReactNode;
    label: string;
    key: "home" | "courses" | "notes" | "learn";
    path: string;
};

const HOME_PATH_BY_VARIANT: Record<Variant, string> = {
    university: "/dashboard",
    secondary: "/secondary/dashboard",
    parent: "/parent/dashboard",
    school_admin: "/school/dashboard",
};

const NAV_ITEMS_BY_VARIANT: Record<Variant, SidebarNavItem[]> = {
    university: [
        { icon: <Home className="w-5 h-5" />, label: "Home", key: "home", path: "/dashboard" },
        { icon: <BookOpen className="w-5 h-5" />, label: "Courses", key: "courses", path: "/courses" },
        { icon: <FileText className="w-5 h-5" />, label: "Notes", key: "notes", path: "/notes" },
    ],
    secondary: [
        { icon: <Home className="w-5 h-5" />, label: "Home", key: "home", path: "/secondary/dashboard" },
        { icon: <GraduationCap className="w-5 h-5" />, label: "Learn", key: "learn", path: "/secondary/learn" },
    ],
    parent: [
        { icon: <Home className="w-5 h-5" />, label: "Home", key: "home", path: "/parent/dashboard" },
    ],
    school_admin: [
        { icon: <Home className="w-5 h-5" />, label: "Home", key: "home", path: "/school/dashboard" },
    ],
};

/**
 * The single source of truth for which sidebar a given account gets.
 * school_admin is a role (those accounts have no user_type of their own), so
 * it's checked first. Anything unresolved falls back to "university" — the
 * only variant that gets the Courses/Notes nav items.
 */
export function deriveVariant(userType: UserType | null, role: UserRole | null): Variant {
    if (role === "school_admin") return "school_admin";
    if (userType === "secondary") return "secondary";
    if (userType === "parent") return "parent";
    return "university";
}

export default function AppSidebar({ userName, activeItem, onSignOut, variant: variantProp }: AppSidebarProps) {
    const { session } = useAuth();
    const { userType, role } = useUserProfile();
    const [, navigate] = useLocation();
    const variant = variantProp ?? deriveVariant(userType, role);
    const [isMobile, setIsMobile] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [desktopOpen, setDesktopOpen] = useState(true);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const accessToken = session?.access_token;
    const navItems = NAV_ITEMS_BY_VARIANT[variant];
    const homePath = HOME_PATH_BY_VARIANT[variant];

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768);
        handleResize();
        window.addEventListener("resize", handleResize);
        return () => window.removeEventListener("resize", handleResize);
    }, []);

    // The drawer slides in from the RIGHT, the side its button is on, so the
    // panel appears under the thumb that opened it. Closing on Escape and
    // locking the page behind it are what make it read as a drawer rather
    // than a dropdown.
    useEffect(() => {
        if (!mobileMenuOpen) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileMenuOpen(false);
        };
        const previous = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        window.addEventListener("keydown", onKey);
        return () => {
            document.body.style.overflow = previous;
            window.removeEventListener("keydown", onKey);
        };
    }, [mobileMenuOpen]);

    const goTo = (path: string) => {
        navigate(path);
        setMobileMenuOpen(false);
    };

    const NavList = () => (
        <>
            {navItems.map((item) => {
                const isActive = item.key === activeItem;
                return (
                    <button
                        key={item.key}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-muted-foreground hover:text-foreground hover:bg-card"
                        }`}
                        onClick={() => goTo(item.path)}
                        data-testid={`sidebar-${item.key}`}
                    >
                        {item.icon}
                        {item.label}
                    </button>
                );
            })}
        </>
    );

    // Parent and school-admin accounts are analysis-only — no credits, no
    // plan, nothing to bill — so the credits display and the profile (plan &
    // billing) page don't apply and are hidden rather than shown with
    // irrelevant content. Their name still shows, and Sign Out stays.
    const showProfile = variant !== "parent" && variant !== "school_admin";

    const UserSection = () => (
        <div className="flex flex-col gap-2">
            {showProfile && <CreditsDisplay />}
            {showProfile ? (
                <button
                    onClick={() => goTo("/profile")}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl w-full text-left transition-colors ${
                        activeItem === "profile" ? "bg-primary/10" : "hover:bg-card"
                    }`}
                    data-testid="sidebar-profile"
                >
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <span className={`text-sm truncate font-medium ${activeItem === "profile" ? "text-primary" : "text-foreground/90"}`}>
                        {userName}
                    </span>
                </button>
            ) : (
                <div className="flex items-center gap-3 px-4 py-3 rounded-xl w-full">
                    <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                        {userName.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm truncate font-medium text-foreground/90">{userName}</span>
                </div>
            )}
            <ThemeToggle />
            <DyslexiaToggle />
            <Button
                variant="outline"
                size="sm"
                onClick={onSignOut}
                className="w-full border-muted-foreground/30 text-foreground/90 hover:text-foreground hover:bg-muted gap-2"
                data-testid="button-sign-out"
            >
                <LogOut className="w-4 h-4" />
                Sign Out
            </Button>
        </div>
    );

    if (isMobile) {
        return (
            <div className="w-full sticky top-0 z-40">
                {/* Top bar — logo on the left, menu toggle on the RIGHT */}
                <div className="flex items-center justify-between px-4 py-3 glass-chip border-b border-border/50">
                    <div className="flex items-center gap-2 cursor-pointer" onClick={() => goTo(homePath)}>
                        <img src={mindfillLogo} alt="TECHCESS Logo" className="w-7 h-7 object-contain" />
                        <h2 className="text-base font-bold text-foreground tracking-tight">TECHCESS</h2>
                    </div>
                    <button
                        onClick={() => setMobileMenuOpen((v) => !v)}
                        className="p-2 rounded-lg text-foreground hover:bg-muted transition-colors"
                        data-testid="button-mobile-menu"
                        aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
                        aria-expanded={mobileMenuOpen}
                        aria-controls="mobile-nav-drawer"
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Dimmed page behind the drawer — tap anywhere to close. */}
                <div
                    className={`fixed inset-0 z-40 bg-background/60 backdrop-blur-[2px] transition-opacity duration-300 ${
                        mobileMenuOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                    }`}
                    onClick={() => setMobileMenuOpen(false)}
                    aria-hidden
                />

                {/* Drawer — slides in from the LEFT (David's call), matching the
                desktop sidebar's side, even though its button sits on the right. */}
                <div
                    ref={dropdownRef}
                    id="mobile-nav-drawer"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Menu"
                    aria-hidden={!mobileMenuOpen}
                    className={`fixed top-0 left-0 z-50 h-[100dvh] w-[84%] max-w-xs glass-panel border-r border-border/50 flex flex-col transition-transform duration-300 ease-out ${
                        mobileMenuOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
                    }`}
                >
                    <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
                        <span className="text-sm font-semibold tracking-tight">Menu</span>
                        <button
                            onClick={() => setMobileMenuOpen(false)}
                            className="p-2 -mr-2 rounded-lg text-foreground hover:bg-muted transition-colors"
                            aria-label="Close menu"
                            tabIndex={mobileMenuOpen ? 0 : -1}
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
                        <nav className="space-y-1">
                            <NavList />
                        </nav>
                        <div className="pt-2 border-t border-border/50">
                            <DropReviewDialog accessToken={accessToken} />
                        </div>
                    </div>
                    <div className="px-4 pb-[calc(1rem+env(safe-area-inset-bottom,0px))] pt-2 border-t border-border/50">
                        <UserSection />
                    </div>
                </div>
            </div>
        );
    }

    // Both states stay mounted and cross-fade/width-transition via CSS
    // instead of hard-swapping between an <aside> and a bare button — that
    // swap had zero animation, which read as an abrupt on/off toggle.
    return (
        <>
            <aside
                className={`sticky top-0 h-[100dvh] flex-shrink-0 glass-panel border-r flex flex-col whitespace-nowrap overflow-hidden transition-all duration-300 ease-in-out ${
                    desktopOpen ? "w-64 opacity-100" : "w-0 opacity-0 border-r-0"
                }`}
                data-testid="sidebar"
            >
                <div className="w-64 flex flex-col h-full flex-shrink-0">
                    <div className="flex items-center justify-between gap-2 p-6 border-b border-border/50">
                        <div className="flex items-center gap-2 cursor-pointer group" onClick={() => goTo(homePath)}>
                            <img src={mindfillLogo} alt="TECHCESS Logo" className="w-8 h-8 object-contain" />
                            <h2 className="text-lg font-bold text-foreground tracking-tight">TECHCESS</h2>
                        </div>
                        <button
                            onClick={() => setDesktopOpen(false)}
                            className="p-1.5 -mr-1.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors"
                            aria-label="Collapse sidebar"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
                        <NavList />
                    </nav>

                    <div className="px-4 pb-4">
                        <DropReviewDialog accessToken={accessToken} />
                    </div>

                    <div className="p-4 border-t border-border/50">
                        <UserSection />
                    </div>
                </div>
            </aside>
            {/* Fixed (not flex-flow) positioning — it must never reserve
            layout width next to the aside, only overlay once collapsed. */}
            <button
                onClick={() => setDesktopOpen(true)}
                className={`fixed top-4 left-4 z-40 p-2 rounded-lg glass-chip text-foreground shadow-md hover:brightness-110 transition-all duration-300 ease-in-out ${
                    desktopOpen ? "opacity-0 pointer-events-none -translate-x-2" : "opacity-100"
                }`}
                aria-label="Open sidebar"
                tabIndex={desktopOpen ? -1 : 0}
            >
                <Menu className="w-5 h-5" />
            </button>
        </>
    );
}
