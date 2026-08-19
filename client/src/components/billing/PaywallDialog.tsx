import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useSubscription } from "@/hooks/use-subscription";
import PlanSelector from "./PlanSelector";
import { Zap } from "lucide-react";

/**
 * App-wide upgrade prompt. Opened by `promptUpgrade()` from the subscription
 * context — call that wherever a free user hits a 402 / out-of-credits.
 */
export default function PaywallDialog() {
    const { paywallOpen, closeUpgrade } = useSubscription();

    return (
        <Dialog open={paywallOpen} onOpenChange={(open) => !open && closeUpgrade()}>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                        <Zap className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-xl">You're out of credits</DialogTitle>
                    <DialogDescription>
                        Upgrade to Pro for unlimited chat, quizzes, flashcards and visualizations — no credit limits.
                    </DialogDescription>
                </DialogHeader>

                <div className="pt-2">
                    <PlanSelector onRedirect={closeUpgrade} />
                </div>
            </DialogContent>
        </Dialog>
    );
}
