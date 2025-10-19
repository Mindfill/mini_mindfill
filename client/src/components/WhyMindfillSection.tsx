import { useEffect, useRef, useState } from "react";
import { Brain, Zap, Sparkles } from "lucide-react";

interface BenefitCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

function BenefitCard({ icon, title, description, testId }: BenefitCardProps) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsVisible(true);
          }
        });
      },
      { threshold: 0.2 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative p-8 rounded-xl border transition-all duration-700 hover-elevate ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
      }`}
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        borderColor: "rgba(0, 255, 136, 0.2)",
      }}
      data-testid={testId}
    >
      <div
        className="w-16 h-16 mb-6 flex items-center justify-center rounded-lg"
        style={{
          background: "rgba(0, 255, 136, 0.1)",
          border: "1px solid rgba(0, 255, 136, 0.3)",
        }}
      >
        <div className="text-[hsl(158,100%,50%)]">{icon}</div>
      </div>

      <h3 className="text-2xl font-semibold mb-4" data-testid={`text-${testId}-title`}>
        {title}
      </h3>

      <p className="text-white/60 leading-relaxed" data-testid={`text-${testId}-description`}>
        {description}
      </p>
    </div>
  );
}

export default function WhyMindfillSection() {
  return (
    <section id="why-mindfill" className="py-24 px-6 lg:px-8 bg-black">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16" data-testid="text-why-headline">
          Why Mindfill
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <BenefitCard
            icon={<Brain className="w-8 h-8" />}
            title="Deeper Understanding"
            description="Move beyond surface-level knowledge. Our AI guides you through layered explanations that build genuine comprehension."
            testId="card-understanding"
          />

          <BenefitCard
            icon={<Zap className="w-8 h-8" />}
            title="Adaptive Learning"
            description="Your learning path adjusts in real-time. Questions adapt to your level, ensuring optimal challenge and growth."
            testId="card-adaptive"
          />

          <BenefitCard
            icon={<Sparkles className="w-8 h-8" />}
            title="AI Clarity Engine"
            description="Complex STEM concepts explained with unprecedented clarity. Our AI breaks down barriers to understanding."
            testId="card-clarity"
          />
        </div>
      </div>
    </section>
  );
}
