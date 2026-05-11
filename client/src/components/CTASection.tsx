import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Sparkles } from "lucide-react";

export default function CTASection() {
  return (
    <section className="py-24 md:py-40 px-6 lg:px-8 relative overflow-hidden bg-black border-t border-white/5">
      {/* Subtle slate radial pulse in center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] md:w-[800px] h-[300px] md:h-[800px] bg-primary/5 rounded-full blur-[80px] md:blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-20">
        <h2
          className="text-4xl md:text-9xl font-bold mb-8 md:mb-12 text-white tracking-tight leading-tight"
          data-testid="text-cta-headline"
        >
          Mastery <br />
          <span className="text-white/20">Awaits.</span>
        </h2>

        <Link href="/login">
          <Button
            size="lg"
            className="w-full sm:w-auto group relative bg-white text-black hover:bg-white/90 rounded-full px-10 md:px-16 py-6 md:py-10 text-base md:text-xl font-bold transition-all duration-500 shadow-2xl overflow-hidden"
            data-testid="button-join-beta-cta"
          >
            <span className="relative z-10 flex items-center justify-center gap-3">
              Start Your Free Journey
              <Sparkles className="w-4 h-4 md:w-5 md:h-5 text-primary animate-pulse" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-primary/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          </Button>
        </Link>
        
        <p className="mt-8 md:mt-10 text-white/20 text-[10px] md:text-xs font-bold tracking-[0.2em] uppercase">
          Join the intellectual vanguard today.
        </p>
      </div>
    </section>
  );
}
