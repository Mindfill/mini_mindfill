import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import ParticleBackground from "./ParticleBackground";
import { ArrowRight, PlayCircle } from "lucide-react";

export default function HeroSection() {
  const scrollToVideo = () => {
    const element = document.querySelector("#how-it-works");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden bg-black">
      <ParticleBackground />
      
      {/* Subtle slate radial overlay */}
      <div
        className="absolute inset-0 z-10"
        style={{
          background: "radial-gradient(circle at 50% 50%, rgba(71, 100, 120, 0.1) 0%, transparent 80%)",
        }}
      />

      {/* Content */}
      <div className="relative z-20 max-w-6xl mx-auto px-6 lg:px-8 text-center pt-20">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-white/5 bg-white/5 mb-10 animate-fadeIn">
          <span className="text-[10px] font-bold tracking-[0.3em] uppercase text-white/40">
            Intelligent Learning Infrastructure
          </span>
        </div>

        <h1
          className="text-6xl md:text-9xl font-bold mb-10 tracking-tight text-white leading-[1.05]"
          data-testid="text-hero-headline"
        >
          Mastery through <br />
          <span className="text-white/20">Deep Reasoning.</span>
        </h1>

        <p className="text-lg md:text-2xl text-white/40 mb-16 max-w-3xl mx-auto leading-relaxed font-normal" data-testid="text-hero-subtext">
          Mindfill bridges the gap between intuitive understanding and formal mastery using first-principles AI.
        </p>

        <div className="flex flex-col sm:flex-row gap-6 justify-center items-center">
          <Link href="/login">
            <Button
              size="lg"
              className="group bg-white text-black hover:bg-white/90 rounded-full px-10 py-8 text-base font-bold transition-all duration-500 shadow-[0_0_40px_rgba(255,255,255,0.1)] flex items-center gap-2"
              data-testid="button-join-waitlist"
            >
              Begin Your Journey
              <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>

          <Button
            size="lg"
            variant="outline"
            className="group rounded-full border-white/10 bg-white/5 text-white/80 hover:text-white hover:bg-white/10 px-10 py-8 text-base font-bold transition-all duration-500 backdrop-blur-md flex items-center gap-2"
            onClick={scrollToVideo}
            data-testid="button-see-demo"
          >
            <PlayCircle className="w-5 h-5 text-primary" />
            System Walkthrough
          </Button>
        </div>
      </div>

      {/* Bottom fade into next section */}
      <div className="absolute bottom-0 left-0 right-0 h-40 z-10"
        style={{ background: "linear-gradient(to top, black, transparent)" }} />
    </section>
  );
}
