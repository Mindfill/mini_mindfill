import { useEffect, useRef, useState } from "react";
import { Lightbulb, Users, Sparkles, Target } from "lucide-react";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";

interface BenefitCardProps {
  number: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

function BenefitCard({ number, icon, title, description, testId }: BenefitCardProps) {
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
      { threshold: 0.1 }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={cardRef}
      className={`relative p-8 md:p-10 rounded-2xl border transition-all duration-1000 group ${isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        }`}
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        borderColor: "rgba(255, 255, 255, 0.05)",
      }}
      data-testid={testId}
    >
      <div className="w-10 h-10 md:w-12 md:h-12 mb-6 md:mb-8 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all duration-500">
        {icon}
      </div>

      <h3 className="text-lg md:text-xl font-bold mb-3 md:mb-4 text-white tracking-tight" data-testid={`text-${testId}-title`}>
        {title}
      </h3>

      <p className="text-sm md:text-base text-white/40 leading-relaxed font-normal" data-testid={`text-${testId}-description`}>
        {description}
      </p>
    </div>
  );
}

export default function WhyMindfillSection() {
  return (
    <section id="why-mindfill" className="py-20 md:py-32 px-6 lg:px-8 relative overflow-hidden bg-black">
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="max-w-3xl mb-16 md:mb-24">
          <p className="text-primary text-xs font-bold tracking-[0.3em] uppercase mb-4">Core Benefits</p>
          <h2 className="text-3xl md:text-6xl font-bold text-white tracking-tight leading-tight" data-testid="text-why-headline">
            Why Choose <br className="hidden md:block" />
            <span className="text-white/40">TECHCESS.</span>
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          <BenefitCard
            number="01"
            icon={<Lightbulb className="w-6 h-6" />}
            title="Genius Thinking"
            description="We don't just explain — we teach you how to think from first principles."
            testId="card-genius"
          />

          <BenefitCard
            number="02"
            icon={<Users className="w-6 h-6" />}
            title="AI Precision"
            description="Our Clarity Engine fine-tunes explanations to your exact level of understanding."
            testId="card-adaptive"
          />

          <BenefitCard
            number="03"
            icon={<Sparkles className="w-6 h-6" />}
            title="Deep Insights"
            description="Skip rote memorization. Gain intuitive insights that stay with you forever."
            testId="card-first-principles"
          />

          <BenefitCard
            number="04"
            icon={<Target className="w-6 h-6" />}
            title="STEM Mastery"
            description="Specialized guidance for complex technical subjects from math to physics."
            testId="card-stem"
          />
        </div>
      </div>
    </section>
  );
}
