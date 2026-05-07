import { Layers, Network, GraduationCap } from "lucide-react";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";

interface BentoCardProps {
  icon: React.ReactNode;
  number: string;
  title: string;
  description: string;
  className?: string;
  testId: string;
}

function BentoCard({ icon, number, title, description, className, testId }: BentoCardProps) {
  return (
    <div
      className={`relative p-10 rounded-2xl border transition-all duration-500 group hover:border-primary/30 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        borderColor: "rgba(255, 255, 255, 0.05)",
      }}
      data-testid={testId}
    >
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-xl bg-primary/10 border border-primary/20 text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500"
        >
          {icon}
        </div>
        <div className="h-px flex-grow bg-white/10" />
        <div className="text-sm font-bold text-white/20 tracking-widest uppercase">
          Phase {number}
        </div>
      </div>

      <h3 className="text-2xl font-bold mb-4 text-white tracking-tight" data-testid={`text-${testId}-title`}>
        {title}
      </h3>

      <p className="text-white/40 leading-relaxed font-normal text-base" data-testid={`text-${testId}-description`}>
        {description}
      </p>

      {/* Subtle hover background highlight */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none rounded-2xl"
           style={{ background: "radial-gradient(circle at top right, rgba(37, 99, 235, 0.05) 0%, transparent 60%)" }} />
    </div>
  );
}

export default function MindfillMethodSection() {
  return (
    <section id="method" className="py-32 px-6 lg:px-8 relative overflow-hidden bg-black">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-20">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-bold tracking-[0.3em] uppercase mb-4">The Methodology</p>
            <h2 className="text-4xl md:text-6xl font-bold text-white tracking-tight" data-testid="text-method-headline">
              A 3-Layer System for <br />
              <span className="text-white/40">Technical Mastery.</span>
            </h2>
          </div>
          <p className="text-lg text-white/30 max-w-sm font-normal leading-relaxed mb-2" data-testid="text-method-subtext">
            Bridging the gap between conceptual intuition and rigorous formal understanding.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <BentoCard
            icon={<Layers className="w-6 h-6" />}
            number="01"
            title="Intuitive Foundation"
            description="Start with relatable concepts and mental models. We prioritize 'the click' before the complexity."
            testId="step-intuitive"
          />

          <BentoCard
            icon={<Network className="w-6 h-6" />}
            number="02"
            title="Structural Linking"
            description="Connect individual ideas into a cohesive framework. Understand the 'how' and 'where' everything fits."
            testId="step-structured"
          />

          <BentoCard
            icon={<GraduationCap className="w-6 h-6" />}
            number="03"
            title="Formal Rigor"
            description="Develop deep technical expertise with mathematical precision. Master the formal language of your subject."
            testId="step-rigorous"
          />
        </div>
      </div>
    </section>
  );
}
