import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Home, BookOpen, LogOut, Menu, X, FileText } from "lucide-react";
import { gsap } from "gsap";
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
    activeItem: "home" | "courses" | "notes" | "profile";
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
    key: "home" | "courses" | "notes";
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

    useEffect(() => {
        const el = dropdownRef.current;
        if (!el) return;

        if (mobileMenuOpen) {
            gsap.set(el, { display: "block", height: "auto" });
            const fullHeight = el.offsetHeight;
            gsap.fromTo(
                el,
                { height: 0, opacity: 0 },
                { height: fullHeight, opacity: 1, duration: 0.32, ease: "power2.out" }
            );
        } else if (el.style.display !== "none") {
            gsap.to(el, {
                height: 0,
                opacity: 0,
                duration: 0.24,
                ease: "power2.in",
                onComplete: () => gsap.set(el, { display: "none" }),
            });
        }
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

    // Parent accounts are analysis-only — there's no plan/billing concept for
    // them, so the profile (plan & billing) page doesn't apply and its nav
    // entry is hidden rather than shown with irrelevant content.
    const showProfile = variant !== "parent";

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
                    >
                        {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                    </button>
                </div>

                {/* Vertical dropdown — expands downward beneath the top bar */}
                <div
                    ref={dropdownRef}
                    style={{ display: "none", overflow: "hidden" }}
                    className="glass-chip border-b border-border/50 px-4 py-4 space-y-4"
                >
                    <nav className="space-y-1">
                        <NavList />
                    </nav>
                    <div className="pt-2 border-t border-border/50">
                        <DropReviewDialog accessToken={accessToken} />
                    </div>
                    <UserSection />
                </div>

                {mobileMenuOpen && (
                    <div
                        className="fixed inset-0 z-30 bg-background/40"
                        style={{ top: "var(--mobile-topbar-height, 64px)" }}
                        onClick={() => setMobileMenuOpen(false)}
                    />
                )}
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
