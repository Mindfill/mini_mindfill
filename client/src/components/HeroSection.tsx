import { Button } from "@/components/ui/button";
import ParticleBackground from "./ParticleBackground";

export default function HeroSection() {
  return (
    <section className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
      <ParticleBackground />
      
      <div className="relative z-10 max-w-5xl mx-auto px-6 lg:px-8 text-center">
        <h1 
          className="text-5xl md:text-7xl font-bold mb-6 tracking-tight"
          style={{
            textShadow: "0 0 40px rgba(0, 255, 136, 0.3)"
          }}
          data-testid="text-hero-headline"
        >
          Fill Your Mind.{" "}
          <span className="text-[hsl(158,100%,50%)]">
            Master Anything.
          </span>
        </h1>
        
        <p className="text-xl md:text-2xl text-white/70 mb-12 max-w-3xl mx-auto" data-testid="text-hero-subtext">
          AI-powered understanding through layered explanations and deep reasoning.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button
            size="lg"
            className="bg-[hsl(158,100%,50%)] text-black hover:bg-[hsl(158,100%,50%)] px-10 py-6 text-lg font-semibold animate-pulse"
            style={{
              boxShadow: "0 0 40px rgba(0, 255, 136, 0.6)",
              animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
            }}
            data-testid="button-start-learning"
          >
            Start Learning
          </Button>
          
          <Button
            size="lg"
            variant="outline"
            className="border-2 border-white text-white bg-white/5 backdrop-blur-sm hover:bg-white/10 px-10 py-6 text-lg font-semibold"
            data-testid="button-see-demo"
          >
            See Demo
          </Button>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent" />
    </section>
  );
}
