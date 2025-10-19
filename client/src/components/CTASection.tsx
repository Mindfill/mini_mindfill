import { useState } from "react";
import { Button } from "@/components/ui/button";
import WaitlistDialog from "./WaitlistDialog";

export default function CTASection() {
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  return (
    <section className="py-32 px-6 lg:px-8 bg-black relative overflow-hidden">
      <div 
        className="absolute inset-0 opacity-30"
        style={{
          background: "radial-gradient(circle at center, rgba(0, 255, 136, 0.15) 0%, transparent 70%)"
        }}
      />
      
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h2 
          className="text-4xl md:text-6xl font-bold mb-8"
          style={{
            textShadow: "0 0 40px rgba(0, 255, 136, 0.3)"
          }}
          data-testid="text-cta-headline"
        >
          Join the next era of{" "}
          <span className="text-[hsl(158,100%,50%)]">learning.</span>
        </h2>

        <Button
          size="lg"
          className="bg-[hsl(158,100%,50%)] text-black hover:bg-[hsl(158,100%,50%)] px-12 py-7 text-xl font-bold"
          style={{
            boxShadow: "0 0 50px rgba(0, 255, 136, 0.6)",
            animation: "pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite"
          }}
          onClick={() => setWaitlistOpen(true)}
          data-testid="button-join-beta-cta"
        >
          Join Beta
        </Button>
      </div>

      <WaitlistDialog open={waitlistOpen} onOpenChange={setWaitlistOpen} />
    </section>
  );
}
