import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { MessageSquarePlus, Loader2 } from "lucide-react";
import { submitReview } from "@/lib/api";

interface DropReviewDialogProps {
    accessToken?: string;
    triggerButton?: React.ReactNode;
}

export function DropReviewDialog({ accessToken, triggerButton }: DropReviewDialogProps) {
    const [open, setOpen] = useState(false);
    const [name, setName] = useState("");
    const [suggestion, setSuggestion] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !suggestion.trim()) return;

        try {
            setIsSubmitting(true);
            await submitReview(name, suggestion, accessToken);
            toast({
                title: "Review Submitted",
                description: "Thank you for your feedback! We appreciate it.",
            });
            setOpen(false);
            setName("");
            setSuggestion("");
        } catch (error) {
            console.error("Failed to submit review:", error);
            toast({
                variant: "destructive",
                title: "Submission Failed",
                description: "There was an error submitting your review. Please try again.",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {triggerButton || (
                    <button
                        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 text-primary bg-primary/10 hover:bg-primary/20 shadow-[0_0_15px_rgba(245, 158, 11,0.2)] hover:shadow-[0_0_20px_rgba(245, 158, 11,0.4)] border border-primary/20"
                        data-testid="sidebar-drop-review"
                    >
                        <MessageSquarePlus className="w-5 h-5" />
                        Drop Review
                    </button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px] bg-background border-border text-foreground">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold text-foreground">
                        Drop a <span className="text-primary">Review</span>
                    </DialogTitle>
                    <DialogDescription className="text-muted-foreground">
                        Let us know how we can improve your learning experience. We read every suggestion!
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4 mt-4">
                    <div className="space-y-2">
                        <Label htmlFor="name" className="text-foreground/90">
                            Your Name
                        </Label>
                        <Input
                            id="name"
                            placeholder="e.g. John Doe"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="suggestion" className="text-foreground/90">
                            Your Suggestion
                        </Label>
                        <Textarea
                            id="suggestion"
                            placeholder="What could be better?"
                            value={suggestion}
                            onChange={(e) => setSuggestion(e.target.value)}
                            className="min-h-[100px] bg-card border-border text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-[#F59E0B] resize-none"
                            required
                            disabled={isSubmitting}
                        />
                    </div>
                    <div className="pt-2 flex justify-end">
                        <Button
                            type="submit"
                            disabled={isSubmitting || !name.trim() || !suggestion.trim()}
                            className="bg-primary text-primary-foreground hover:bg-primary/90 font-medium gap-2"
                        >
                            {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                            Submit Suggestion
                        </Button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
