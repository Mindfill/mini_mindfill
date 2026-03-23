import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";

export default function CTASection() {
  return (
    <section className="py-32 px-6 lg:px-8 relative overflow-hidden bg-white" style={{ backgroundColor: "#C9C9C5" }}>
      <AnimatedGradientBg />

      {/* Extra amber radial pulse in center */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-4xl mx-auto text-center relative z-20">
        <h2
          className="text-4xl md:text-6xl font-bold mb-8 text-stone-900"
          style={{
            textShadow: "0 0 40px rgba(245, 158, 11, 0.2)"
          }}
          data-testid="text-cta-headline"
        >
          Join the next era of{" "}
          <span className="text-primary">learning.</span>
        </h2>

        <Link href="/login">
          <Button
            size="lg"
            className="rounded-2xl bg-amber-500 hover:bg-amber-600 text-white px-12 py-7 text-xl font-bold transition-all duration-300"
            style={{
              boxShadow: "0 0 50px rgba(245, 158, 11, 0.5), 0 4px 24px rgba(180, 83, 9, 0.3)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }}
            data-testid="button-join-beta-cta"
          >
            Join Beta
          </Button>
        </Link>
      </div>
    </section>
  );
}
