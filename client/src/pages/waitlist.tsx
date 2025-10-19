import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import ParticleBackground from "@/components/ParticleBackground";

export default function Waitlist() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission
    const backendUrl = import.meta.env.VITE_BACKEND_URL;

const res = await fetch(`${backendUrl}/api/join`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ name, email }),
});

if (!res.ok) throw new Error("Failed to join waitlist");


    setIsSubmitted(true);
    setIsSubmitting(false);

    toast({
      title: "You're on the list!",
      description: "We'll notify you when Mindfill launches.",
    });
  };

  return (
    <div className="min-h-screen bg-black text-white relative overflow-hidden">
      <ParticleBackground />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="p-6">
          <Link href="/">
            <Button
              variant="ghost"
              className="text-white/70 hover:text-[hsl(158,100%,50%)]"
              data-testid="button-back"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>

        <div className="flex-1 flex items-center justify-center px-6">
          <div className="max-w-md w-full">
            {!isSubmitted ? (
              <div
                className="p-8 rounded-xl border"
                style={{
                  background: "rgba(0, 0, 0, 0.8)",
                  borderColor: "rgba(0, 255, 136, 0.3)",
                  boxShadow: "0 0 40px rgba(0, 255, 136, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div className="text-center mb-8">
                  <h1
                    className="text-2xl font-bold mb-2"
                    style={{
                      color: "hsl(158, 100%, 50%)",
                      textShadow: "0 0 20px rgba(0, 255, 136, 0.5)",
                    }}
                    data-testid="text-logo"
                  >
                    Mindfill
                  </h1>
                  <h2 className="text-4xl font-bold mb-4" data-testid="text-headline">
                    Join the{" "}
                    <span className="text-[hsl(158,100%,50%)]">Waitlist</span>
                  </h2>
                  <p className="text-white/60" data-testid="text-subtext">
                    Be among the first to experience the future of learning.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-white/90">
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-[hsl(158,100%,50%)]"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white/90">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-white/5 border-white/20 text-white placeholder:text-white/40 focus-visible:ring-[hsl(158,100%,50%)]"
                      data-testid="input-email"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-[hsl(158,100%,50%)] text-black hover:bg-[hsl(158,100%,50%)] py-6 text-lg font-semibold"
                    style={{
                      boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)",
                    }}
                    disabled={isSubmitting}
                    data-testid="button-submit"
                  >
                    {isSubmitting ? "Joining..." : "Join Waitlist"}
                  </Button>
                </form>
              </div>
            ) : (
              <div
                className="p-12 rounded-xl border text-center"
                style={{
                  background: "rgba(0, 0, 0, 0.8)",
                  borderColor: "rgba(0, 255, 136, 0.3)",
                  boxShadow: "0 0 40px rgba(0, 255, 136, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(0, 255, 136, 0.1)",
                    border: "2px solid hsl(158, 100%, 50%)",
                    boxShadow: "0 0 30px rgba(0, 255, 136, 0.4)",
                  }}
                >
                  <CheckCircle2 className="w-10 h-10 text-[hsl(158,100%,50%)]" />
                </div>
                <h2 className="text-3xl font-bold mb-4" data-testid="text-success-headline">
                  You're on the list!
                </h2>
                <p className="text-white/60 mb-8" data-testid="text-success-message">
                  We'll notify you when Mindfill launches. Get ready to master anything.
                </p>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="border-[hsl(158,100%,50%)] text-[hsl(158,100%,50%)] hover:bg-[hsl(158,100%,50%)] hover:text-black"
                    data-testid="button-back-home"
                  >
                    Back to Home
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
