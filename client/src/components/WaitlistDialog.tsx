import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

interface WaitlistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WaitlistDialog({ open, onOpenChange }: WaitlistDialogProps) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    toast({
      title: "You're on the list!",
      description: "We'll notify you when Mindfill launches.",
    });

    setEmail("");
    setName("");
    setIsSubmitting(false);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-black border-white/5 rounded-3xl p-12" data-testid="dialog-waitlist">
        <DialogHeader className="mb-10">
          <DialogTitle className="text-3xl font-bold tracking-tight text-white text-center">
            Join the <span className="text-white/30">Beta</span>
          </DialogTitle>
          <DialogDescription className="text-white/30 font-normal mt-3 text-center">
            Be among the first to experience the future of intelligent learning.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-8">
          <div className="space-y-2">
            <Label htmlFor="name" className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/20 ml-1">
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="bg-white/5 border-white/5 rounded-2xl text-white placeholder:text-white/10 h-14 focus:border-primary/30 transition-all px-6"
              data-testid="input-waitlist-name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email" className="text-[10px] font-bold tracking-[0.2em] uppercase text-white/20 ml-1">
              Email Address
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="bg-white/5 border-white/5 rounded-2xl text-white placeholder:text-white/10 h-14 focus:border-primary/30 transition-all px-6"
              data-testid="input-waitlist-email"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-white/90 rounded-full h-16 text-base font-bold transition-all duration-500 shadow-2xl"
            disabled={isSubmitting}
            data-testid="button-waitlist-submit"
          >
            {isSubmitting ? "Processing Request..." : "Request Access"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
