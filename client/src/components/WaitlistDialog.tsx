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
      <DialogContent className="sm:max-w-md bg-background border-primary" data-testid="dialog-waitlist">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold">
            Join the{" "}
            <span className="text-primary">Waitlist</span>
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Be among the first to experience the future of learning.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
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
              className="bg-card border-muted-foreground/30 text-foreground placeholder:text-muted-foreground"
              data-testid="input-waitlist-name"
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
              className="bg-card border-muted-foreground/30 text-foreground placeholder:text-muted-foreground"
              data-testid="input-waitlist-email"
            />
          </div>
          <Button
            type="submit"
            className="w-full bg-primary text-black hover:bg-primary"
            style={{
              boxShadow: "0 0 30px rgba(245, 158, 11, 0.4)",
            }}
            disabled={isSubmitting}
            data-testid="button-waitlist-submit"
          >
            {isSubmitting ? "Joining..." : "Join Waitlist"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
