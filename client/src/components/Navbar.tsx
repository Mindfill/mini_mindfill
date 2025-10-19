import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = [
    { label: "How it Works", href: "#how-it-works" },
    { label: "For Students", href: "#why-mindfill" },
    { label: "For Schools", href: "#method" },
    { label: "Login", href: "#login" },
  ];

  const scrollToSection = (href: string) => {
    const element = document.querySelector(href);
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
      setMobileMenuOpen(false);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex-shrink-0">
            <h1 
              className="text-2xl font-bold tracking-tight cursor-pointer"
              style={{
                color: "hsl(158, 100%, 50%)",
                textShadow: "0 0 20px rgba(0, 255, 136, 0.5)"
              }}
              data-testid="logo-mindfill"
            >
              Mindfill
            </h1>
          </div>

          <div className="hidden md:flex items-center gap-8">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className="text-sm text-white/90 hover:text-[hsl(158,100%,50%)] transition-colors duration-200"
                data-testid={`link-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.label}
              </button>
            ))}
            <Button
              variant="default"
              size="sm"
              className="bg-[hsl(158,100%,50%)] text-black hover:bg-[hsl(158,100%,50%)]"
              style={{
                boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)"
              }}
              data-testid="button-join-beta-nav"
            >
              Join Beta
            </Button>
          </div>

          <div className="md:hidden">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              data-testid="button-mobile-menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden bg-black/95 backdrop-blur-md border-b border-white/10">
          <div className="px-6 py-4 space-y-3">
            {menuItems.map((item) => (
              <button
                key={item.label}
                onClick={() => scrollToSection(item.href)}
                className="block w-full text-left text-white/90 hover:text-[hsl(158,100%,50%)] transition-colors py-2"
                data-testid={`link-mobile-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
              >
                {item.label}
              </button>
            ))}
            <Button
              variant="default"
              className="w-full bg-[hsl(158,100%,50%)] text-black hover:bg-[hsl(158,100%,50%)]"
              style={{
                boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)"
              }}
              data-testid="button-join-beta-mobile"
            >
              Join Beta
            </Button>
          </div>
        </div>
      )}
    </nav>
  );
}
