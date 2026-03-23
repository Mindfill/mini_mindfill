import { BookOpen, MessageCircle, Trophy } from "lucide-react";

interface FeatureCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

function FeatureCard({ icon, title, description, testId }: FeatureCardProps) {
  return (
    <div 
      className="relative p-8 rounded-xl border transition-all duration-300 hover-elevate group"
      style={{
        background: "rgba(255, 255, 255, 0.02)",
        borderColor: "rgba(245, 158, 11, 0.2)",
      }}
      data-testid={testId}
    >
      <div 
        className="w-16 h-16 mb-6 flex items-center justify-center rounded-lg transition-all duration-300"
        style={{
          background: "rgba(245, 158, 11, 0.1)",
          border: "1px solid rgba(245, 158, 11, 0.3)",
        }}
      >
        <div className="text-primary">
          {icon}
        </div>
      </div>
      
      <h3 className="text-2xl font-semibold mb-4" data-testid={`text-${testId}-title`}>
        {title}
      </h3>
      
      <p className="text-muted-foreground leading-relaxed" data-testid={`text-${testId}-description`}>
        {description}
      </p>
    </div>
  );
}

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 px-6 lg:px-8 bg-background">
      <div className="max-w-7xl mx-auto">
        <h2 className="text-4xl md:text-5xl font-bold text-center mb-16" data-testid="text-how-it-works-headline">
          How It Works
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <FeatureCard
            icon={<BookOpen className="w-8 h-8" />}
            title="Explain"
            description="Complex concepts broken down into intuitive, structured, and rigorous layers. Start simple, go deep when you need to."
            testId="card-explain"
          />
          
          <FeatureCard
            icon={<MessageCircle className="w-8 h-8" />}
            title="Question"
            description="AI adapts to your understanding level, asking the right questions at the right time to strengthen your knowledge."
            testId="card-question"
          />
          
          <FeatureCard
            icon={<Trophy className="w-8 h-8" />}
            title="Master"
            description="Achieve true mastery through deep reasoning and layered comprehension. Not just memorization, but understanding."
            testId="card-master"
          />
        </div>
      </div>
    </section>
  );
}
