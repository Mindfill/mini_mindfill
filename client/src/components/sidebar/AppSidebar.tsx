import { useState } from "react";
import { useLocation } from "wouter";
import { Home, BookOpen, Clock, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { DropReviewDialog } from "./DropReviewDialog";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useEffect } from "react";
import { supabase } from "@/lib/supabase";

interface AppSidebarProps {
    userName: string;
    activeItem: "home" | "courses";
    onSignOut: () => void;
}

type SidebarNavItem = {
    icon: React.ReactNode;
    label: string;
    key: "home" | "courses" | "coming-soon";
    path?: string;
    comingSoon?: boolean;
};

const navItems: SidebarNavItem[] = [
    { icon: <Home className="w-5 h-5" />, label: "Home", key: "home", path: "/dashboard" },
    { icon: <BookOpen className="w-5 h-5" />, label: "Courses", key: "courses", path: "/courses" },
    { icon: <Clock className="w-5 h-5" />, label: "Coming Soon", key: "coming-soon", comingSoon: true },
];

export default function AppSidebar({ userName, activeItem, onSignOut }: AppSidebarProps) {
    const { session } = useAuth();
    const [, navigate] = useLocation();
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const accessToken = session?.access_token;

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 768) {
                setSidebarOpen(false);
            } else {
                setSidebarOpen(true);
            }
        };
        handleResize(); // Set initial state correctly
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return (
        <>
            {/* Floating sidebar toggle */}
            <button
                onClick={() => setSidebarOpen(true)}
                className={`fixed top-4 left-4 z-50 p-2 rounded-lg bg-card/70 backdrop-blur-sm border border-border/50 text-foreground shadow-md hover:brightness-110 transition-all duration-300 ${sidebarOpen ? "opacity-0 pointer-events-none -translate-x-full" : "opacity-100 translate-x-0"
                    }`}
            >
                <Menu className="w-5 h-5" />
            </button>

            {/* Sidebar */}
            <aside
                className={`
          fixed md:sticky top-0 bottom-0 inset-y-0 left-0 z-40 h-[100dvh] bg-background border-r border-border
          transition-all duration-300 ease-in-out overflow-x-hidden
          flex flex-col whitespace-nowrap
          ${sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full w-64 md:translate-x-0 md:w-0"}
        `}
                data-testid="sidebar"
            >
                {/* Logo & Toggle */}
                <div className="flex items-center justify-between p-6 border-b border-border min-w-[256px]">
                    <h2
                        className="text-xl font-bold cursor-pointer text-gradient"
                        style={{
                            textShadow: "0 0 15px rgba(199, 89, 48, 0.5)",
                        }}
                        onClick={() => { navigate("/dashboard"); if (window.innerWidth < 768) setSidebarOpen(false); }}
                    >
                        Mindfill
                    </h2>
                    <button onClick={() => setSidebarOpen(false)} className="p-2 -mr-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-lg transition-colors">
                        <X className="w-5 h-5 md:hidden" />
                        <Menu className="w-5 h-5 hidden md:block" />
                    </button>
                </div>

                {/* Nav items */}
                <nav className="flex-1 p-4 space-y-1 min-w-[256px]">
                    {navItems.map((item) => {
                        const isActive = item.key === activeItem;
                        return (
                            <button
                                key={item.key}
                                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200
                  ${isActive
                                        ? "bg-primary/10 text-primary"
                                        : "text-muted-foreground hover:text-foreground hover:bg-card"
                                    }
                  ${item.comingSoon ? "opacity-50 cursor-not-allowed" : ""}
                `}
                                disabled={item.comingSoon}
                                onClick={() => {
                                    if (item.path && !item.comingSoon) {
                                        navigate(item.path);
                                        setSidebarOpen(false);
                                    }
                                }}
                                data-testid={`sidebar-${item.key}`}
                            >
                                {item.icon}
                                {item.label}
                                {item.comingSoon && (
                                    <span className="ml-auto text-[10px] uppercase tracking-wider bg-muted px-2 py-0.5 rounded-full">
                                        Soon
                                    </span>
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className="px-4 pb-4 min-w-[256px]">
                    <DropReviewDialog accessToken={accessToken} />
                </div>

                {/* User section */}
                <div className="p-4 border-t border-border flex flex-col gap-2 min-w-[256px]">
                    <div className="flex items-center gap-3 px-4 py-3">
                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-sm font-bold flex-shrink-0">
                            {userName.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground/90 truncate font-medium">{userName}</span>
                    </div>
                    <ThemeToggle />
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
            </aside>

            {/* Mobile overlay */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-30 bg-background/60 md:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}
        </>
    );
}
