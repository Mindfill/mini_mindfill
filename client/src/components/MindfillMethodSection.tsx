import { ArrowRight } from "lucide-react";

interface StepProps {
  number: string;
  title: string;
  description: string;
  isLast?: boolean;
  testId: string;
}

function Step({ number, title, description, isLast, testId }: StepProps) {
  return (
    <div className="flex flex-col md:flex-row items-center gap-6 md:gap-8">
      <div className="flex flex-col items-center flex-shrink-0" data-testid={testId}>
        <div 
          className="w-20 h-20 rounded-full flex items-center justify-center text-2xl font-bold relative"
          style={{
            background: "rgba(0, 255, 136, 0.1)",
            border: "2px solid hsl(158, 100%, 50%)",
            boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)",
          }}
        >
          <span className="text-[hsl(158,100%,50%)]" data-testid={`text-${testId}-number`}>
            {number}
          </span>
        </div>
        
        {!isLast && (
          <div className="hidden md:block mt-4">
            <ArrowRight 
              className="w-8 h-8 text-[hsl(158,100%,50%)] rotate-90 md:rotate-0" 
              style={{
                filter: "drop-shadow(0 0 10px rgba(0, 255, 136, 0.5))"
              }}
            />
          </div>
        )}
      </div>
      
      <div className="flex-1 text-center md:text-left">
        <h3 className="text-2xl font-semibold mb-3" data-testid={`text-${testId}-title`}>
          {title}
        </h3>
        <p className="text-white/60 leading-relaxed" data-testid={`text-${testId}-description`}>
          {description}
        </p>
      </div>

      {!isLast && (
        <div className="md:hidden">
          <ArrowRight 
            className="w-8 h-8 text-[hsl(158,100%,50%)] rotate-90" 
            style={{
              filter: "drop-shadow(0 0 10px rgba(0, 255, 136, 0.5))"
            }}
          />
        </div>
      )}
    </div>
  );
}

export default function MindfillMethodSection() {
  return (
    <section id="method" className="py-24 px-6 lg:px-8 bg-black">
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-6" data-testid="text-method-headline">
          The Mindfill Method
        </h2>
        
        <p className="text-xl text-white/70 text-center mb-16 max-w-3xl mx-auto" data-testid="text-method-subtext">
          Our 3-Layer Learning System adapts to your level, ensuring deep comprehension at every stage.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-8">
          <Step
            number="1"
            title="Intuitive"
            description="Start with simple, relatable concepts. Build a foundation using everyday analogies and visual thinking."
            testId="step-intuitive"
          />
          
          <Step
            number="2"
            title="Structured"
            description="Progress to organized frameworks. Connect ideas systematically and understand relationships."
            testId="step-structured"
          />
          
          <Step
            number="3"
            title="Rigorous"
            description="Master the formal details. Develop deep expertise with mathematical precision and technical depth."
            isLast
            testId="step-rigorous"
          />
        </div>
      </div>
    </section>
  );
}
