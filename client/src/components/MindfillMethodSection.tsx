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
      className={`relative p-8 rounded-xl border hover-elevate transition-all duration-300 ${className}`}
      style={{
        background: "rgba(255, 255, 255, 0.7)",
        borderColor: "rgba(245, 158, 11, 0.25)",
      }}
      data-testid={testId}
    >
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-14 h-14 flex-shrink-0 flex items-center justify-center rounded-lg"
          style={{
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.3)",
          }}
        >
          <div className="text-primary">{icon}</div>
        </div>
        <div
          className="text-3xl font-bold text-primary"
          style={{
            textShadow: "0 0 20px rgba(245, 158, 11, 0.3)",
          }}
        >
          {number}
        </div>
      </div>

      <h3 className="text-2xl font-semibold mb-4 text-stone-900" data-testid={`text-${testId}-title`}>
        {title}
      </h3>

      <p className="text-stone-600 leading-relaxed" data-testid={`text-${testId}-description`}>
        {description}
      </p>
    </div>
  );
}

export default function MindfillMethodSection() {
  return (
    <section id="method" className="py-24 px-6 lg:px-8 relative overflow-hidden bg-white" style={{ backgroundColor: "#C9C9C5" }}>
      <AnimatedGradientBg />
      <div className="max-w-7xl mx-auto relative z-10">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6 text-stone-900" data-testid="text-method-headline">
          The Mindfill Method
        </h2>

        <p className="text-xl text-stone-600 text-center mb-16 max-w-3xl mx-auto" data-testid="text-method-subtext">
          Our 3-Layer Learning System adapts to your level, ensuring deep comprehension at every stage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <BentoCard
            icon={<Layers className="w-7 h-7" />}
            number="1"
            title="Intuitive"
            description="Start with simple, relatable concepts. Build a foundation using everyday analogies and visual thinking."
            testId="step-intuitive"
          />

          <BentoCard
            icon={<Network className="w-7 h-7" />}
            number="2"
            title="Structured"
            description="Progress to organized frameworks. Connect ideas systematically and understand relationships."
            testId="step-structured"
          />

          <BentoCard
            icon={<GraduationCap className="w-7 h-7" />}
            number="3"
            title="Rigorous"
            description="Master the formal details. Develop deep expertise with mathematical precision and technical depth."
            testId="step-rigorous"
          />
        </div>
      </div>
    </section>
  );
}
