import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import HeroWave from "@/components/ui/dynamic-wave-canvas-background";

export default function HeroSection() {
  const scrollToVideo = () => {
    const element = document.querySelector("#how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden" style={{ backgroundColor: "#C9C9C5" }}>
      {/* Dynamic animated wave background */}
      <HeroWave />

      {/* Subtle amber radial overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "radial-gradient(ellipse at center, rgba(245, 158, 11, 0.08) 0%, transparent 65%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 max-w-5xl mx-auto px-6 lg:px-8 text-center pt-24">
        <p className="text-sm font-semibold tracking-[0.2em] uppercase text-amber-600 mb-6 opacity-90">
          AI-Powered Learning
        </p>

        <h1
          className="text-5xl md:text-7xl font-bold mb-6 tracking-tight text-white"
          style={{
            textShadow: "0 2px 40px rgba(0,0,0,0.25)"
          }}
          data-testid="text-hero-headline"
        >
          Fill Your Mind.{" "}
          <span style={{ color: "#FCD34D" }}>
            Master Anything.
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-white/85 mb-12 max-w-3xl mx-auto leading-relaxed" data-testid="text-hero-subtext">
          AI-powered understanding through layered explanations and deep reasoning.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href="/login">
            <Button
              size="lg"
              className="rounded-2xl bg-amber-600 hover:bg-amber-700 text-white px-10 py-6 text-lg font-semibold transition-all duration-300"
              style={{
                boxShadow: "0 0 40px rgba(245, 158, 11, 0.5), 0 4px 24px rgba(180, 83, 9, 0.3)"
              }}
              data-testid="button-join-waitlist"
            >
              Join Us
            </Button>
          </Link>

          <Button
            size="lg"
            variant="outline"
            className="rounded-2xl border-2 border-stone-300 bg-white/70 backdrop-blur-sm text-stone-800 hover:bg-white px-10 py-6 text-lg font-semibold transition-all duration-300"
            onClick={scrollToVideo}
            data-testid="button-see-demo"
          >
            See Demo
          </Button>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 z-10"
        style={{ background: "linear-gradient(to top, #C9C9C5, transparent)" }} />
    </section>
  );
}
