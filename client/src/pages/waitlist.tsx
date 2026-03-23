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

  };

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <ParticleBackground />

      <div className="relative z-10 min-h-screen flex flex-col">
        <div className="p-6">
          <Link href="/">
            <Button
              variant="ghost"
              className="text-muted-foreground hover:text-primary"
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
                  borderColor: "rgba(245, 158, 11, 0.3)",
                  boxShadow: "0 0 40px rgba(245, 158, 11, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div className="text-center mb-8">
                  <h1
                    className="text-2xl font-bold mb-2"
                    style={{
                      color: "#F59E0B",
                      textShadow: "0 0 20px rgba(245, 158, 11, 0.5)",
                    }}
                    data-testid="text-logo"
                  >
                    Mindfill
                  </h1>
                  <h2 className="text-4xl font-bold mb-4" data-testid="text-headline">
                    Join the{" "}
                    <span className="text-primary">Waitlist</span>
                  </h2>
                  <p className="text-muted-foreground" data-testid="text-subtext">
                    Be among the first to experience the future of learning.
                  </p>
                </div>

                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    console.log("Submitting form...");   // debug
                    setIsSubmitting(true);

                    try {
                      const backendUrl = import.meta.env.VITE_BACKEND_URL;
                      console.log("Backend URL:", backendUrl);

                      const res = await fetch(`${backendUrl}/api/join`, {
                        method: "POST",
                        headers: { "Content-Type": "application/x-www-form-urlencoded" },
                        body: new URLSearchParams({ name, email }),
                      });

                      if (!res.ok) throw new Error("Failed to join waitlist");

                      setIsSubmitted(true);
                      console.log("isSubmitted set to true");

                      toast({
                        title: "You're on the list!",
                        description: "We'll notify you when Mindfill launches.",
                      });
                    } catch (error) {
                      console.error("Submit error:", error);
                      toast({
                        title: "Error",
                        description: "Something went wrong. Please try again.",
                      });
                    } finally {
                      setIsSubmitting(false);
                    }
                  }}
                  className="space-y-6"
                >
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-foreground">
                      Name
                    </Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="Your name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className="bg-card border-muted-foreground/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-[#F59E0B]"
                      data-testid="input-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-foreground">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="bg-card border-muted-foreground/30 text-foreground placeholder:text-muted-foreground focus-visible:ring-[#F59E0B]"
                      data-testid="input-email"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-primary text-black hover:bg-primary py-6 text-lg font-semibold"
                    style={{ boxShadow: "0 0 30px rgba(245, 158, 11, 0.4)" }}
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
                  borderColor: "rgba(245, 158, 11, 0.3)",
                  boxShadow: "0 0 40px rgba(245, 158, 11, 0.2)",
                  backdropFilter: "blur(10px)",
                }}
              >
                <div
                  className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center"
                  style={{
                    background: "rgba(245, 158, 11, 0.1)",
                    border: "2px solid #F59E0B",
                    boxShadow: "0 0 30px rgba(245, 158, 11, 0.4)",
                  }}
                >
                  <CheckCircle2 className="w-10 h-10 text-primary" />
                </div>
                <h2 className="text-3xl font-bold mb-4" data-testid="text-success-headline">
                  You're on the list!
                </h2>
                <p className="text-muted-foreground mb-8" data-testid="text-success-message">
                  We'll notify you when Mindfill launches. Get ready to master anything.
                </p>
                <Link href="/">
                  <Button
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary hover:text-black"
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
