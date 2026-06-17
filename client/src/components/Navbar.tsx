import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import mindfillLogo from "@/assets/mindfill.png";

export default function Navbar() {
  const { session } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const menuItems = [
    { label: "How it Works", href: "#how-it-works" },
    { label: "For Students", href: "#why-mindfill" },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-6 md:pt-8 px-4">
      <nav
        className={`w-full max-w-5xl rounded-2xl border transition-all duration-500 ${scrolled
          ? "bg-black/80 backdrop-blur-2xl border-white/10 shadow-2xl"
          : "bg-black/20 backdrop-blur-md border-white/5 md:bg-transparent md:border-transparent"
          }`}
      >
        <div className="px-6 md:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/">
              <div className="flex items-center gap-2 md:gap-3 cursor-pointer group">
                <img 
                  src={mindfillLogo} 
                  alt="TECHCESS Logo" 
                  className="w-8 h-8 md:w-10 md:h-10 object-contain transition-transform group-hover:scale-110 duration-500"
                />
                <h1
                  className="text-lg md:text-xl font-bold tracking-tight text-white"
                  data-testid="logo-techcess"
                >
                  TECHCESS
                </h1>
              </div>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-10">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href)}
                  className="text-sm font-medium text-white/50 hover:text-white transition-all duration-300"
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </button>
              ))}

              <Link href={session ? "/dashboard" : "/login"}>
                <Button
                  size="sm"
                  className="bg-white text-black hover:bg-white/90 rounded-full px-6 font-bold text-xs uppercase tracking-widest transition-all duration-300 shadow-lg shadow-white/5"
                  data-testid="button-join-beta-nav"
                >
                  {session ? "Dashboard" : "Join Beta"}
                </Button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden flex items-center gap-4">
              {!session && (
                <Link href="/login">
                  <Button
                    size="sm"
                    className="bg-white text-black hover:bg-white/90 rounded-full px-4 h-9 font-bold text-[10px] uppercase tracking-widest transition-all"
                  >
                    Join
                  </Button>
                </Link>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-white hover:bg-white/5 h-9 w-9"
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 px-6 py-8 space-y-6 bg-black/95 backdrop-blur-3xl rounded-b-2xl animate-fadeIn">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className="block w-full text-left text-base font-medium text-white/50 hover:text-white transition-all py-2"
                data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </button>
            ))}
            {session && (
              <Link href="/dashboard">
                <button className="block w-full text-left text-base font-medium text-white/50 hover:text-white transition-all py-2">
                  Dashboard
                </button>
              </Link>
            )}
          </div>
        )}
      </nav>
    </div>
  );
}
