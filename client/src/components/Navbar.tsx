import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { Link } from "wouter";

export default function Navbar() {
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
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center pt-4 px-4">
      <nav
        className={`w-full max-w-4xl rounded-2xl border transition-all duration-300 ${scrolled
          ? "bg-white/80 backdrop-blur-xl border-stone-200/80 shadow-lg shadow-stone-900/10"
          : "bg-white/60 backdrop-blur-md border-stone-200/50"
          }`}
      >
        <div className="px-6">
          <div className="flex items-center justify-between h-14">
            {/* Logo */}
            <Link href="/">
              <h1
                className="text-xl font-bold tracking-tight cursor-pointer"
                style={{
                  color: "#F59E0B",
                  textShadow: "0 0 16px rgba(245, 158, 11, 0.45)",
                }}
                data-testid="logo-mindfill"
              >
                Mindfill
              </h1>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-6">
              {menuItems.map((item) => (
                <button
                  key={item.label}
                  onClick={() => scrollToSection(item.href)}
                  className="text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors duration-200"
                  data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  {item.label}
                </button>
              ))}

              <Link href="/login">
                <Button
                  size="sm"
                  className="rounded-xl bg-amber-500 text-white hover:bg-amber-600 px-5 font-semibold shadow-[0_0_20px_rgba(245,158,11,0.4)] transition-all duration-200"
                  data-testid="button-join-beta-nav"
                >
                  Join Beta
                </Button>
              </Link>
            </div>

            {/* Mobile hamburger */}
            <div className="md:hidden">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="text-stone-600 hover:text-stone-900"
                data-testid="button-mobile-menu"
              >
                {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Mobile drawer */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-stone-200/50 px-6 py-4 space-y-3">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className="block w-full text-left text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors py-2"
                data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, "-")}`}
              >
                {item.label}
              </button>
            ))}
            <Link href="/login">
              <Button
                className="w-full rounded-xl bg-amber-500 text-white hover:bg-amber-600 font-semibold shadow-[0_0_20px_rgba(245,158,11,0.4)]"
                onClick={() => setMobileMenuOpen(false)}
                data-testid="button-join-beta-mobile"
              >
                Join Beta
              </Button>
            </Link>
          </div>
        )}
      </nav>
    </div>
  );
}
