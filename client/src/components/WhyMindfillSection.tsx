import { useEffect, useRef, useState } from "react";
import { Lightbulb, Users, Sparkles, Target } from "lucide-react";

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
      <div className="flex items-start gap-4 mb-6">
        <div
          className="w-16 h-16 flex-shrink-0 flex items-center justify-center rounded-lg"
          style={{
            background: "rgba(0, 255, 136, 0.1)",
            border: "1px solid rgba(0, 255, 136, 0.3)",
          }}
        >
          <div className="text-[hsl(158,100%,50%)]">{icon}</div>
        </div>
        <div 
          className="text-4xl font-bold text-[hsl(158,100%,50%)]"
          style={{
            textShadow: "0 0 20px rgba(0, 255, 136, 0.3)"
          }}
        >
          {number}
        </div>
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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <BenefitCard
            number="1"
            icon={<Lightbulb className="w-8 h-8" />}
            title="Learn Like a Genius"
            description="Mindfill doesn't just explain — it teaches you to think. Every concept unfolds from intuition to mastery until it finally clicks."
            testId="card-genius"
          />

          <BenefitCard
            number="2"
            icon={<Users className="w-8 h-8" />}
            title="Your AI That Actually Knows You"
            description="The more you learn, the smarter Mindfill gets. It adapts to your strengths, fills your weak spots, and grows with your mind."
            testId="card-adaptive"
          />

          <BenefitCard
            number="3"
            icon={<Sparkles className="w-8 h-8" />}
            title="No More Boring Learning"
            description="Dynamic conversations, glowing visuals, and real understanding — not memorization. Every session feels like a breakthrough."
            testId="card-dynamic"
          />

          <BenefitCard
            number="4"
            icon={<Target className="w-8 h-8" />}
            title="The Science of Clarity"
            description="Mindfill's Clarity Engine fine-tunes every explanation for precision, keeping you in your zone of focus and flow."
            testId="card-clarity"
          />
        </div>
      </div>
    </section>
  );
}
