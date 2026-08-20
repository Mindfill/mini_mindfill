import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { initiatePayment, type PaymentPlan } from "@/lib/api";
import { Check, Loader2, Sparkles } from "lucide-react";

/**
 * Plan catalogue. Prices are display-only — the payment provider is the source
 * of truth for what's actually charged. EDIT THESE to match your live plans.
 */
interface PlanInfo {
    id: PaymentPlan;
    name: string;
    price: string;
    cadence: string;
    /** Optional str/badge, e.g. savings vs monthly. */
    badge?: string;
    subtitle?: string;
}

const PLANS: PlanInfo[] = [
    {
        id: "pro_monthly",
        name: "Pro Monthly",
        price: "₦15,000",
        cadence: "per month",
        subtitle: "Billed monthly. Cancel anytime.",
    },
    {
        id: "pro_yearly",
        name: "Pro Yearly",
        price: "₦120,000",
        cadence: "per year",
        badge: "Save 33%",
        subtitle: "Billed once a year. Best value.",
    },
];

const PRO_PERKS = [
    "Unlimited AI chat & explanations",
    "Unlimited quizzes & flashcards",
    "Concept visualizations",
    "No credit limits",
];

interface PlanSelectorProps {
    /** Called after a successful initiate, right before redirecting away. */
    onRedirect?: () => void;
}

export default function PlanSelector({ onRedirect }: PlanSelectorProps) {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";

    const [selected, setSelected] = useState<PaymentPlan>("pro_yearly");
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleContinue = async () => {
        if (submitting || !accessToken) return;
        setSubmitting(true);
        setError(null);
        try {
            const { payment_url } = await initiatePayment(selected, accessToken);
            onRedirect?.();
            window.location.href = payment_url;
        } catch (err) {
            console.error("Failed to start checkout:", err);
            setError("Couldn't start checkout. Please try again.");
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Perks */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {PRO_PERKS.map((perk) => (
                    <li key={perk} className="flex items-center gap-2 text-sm text-foreground/90">
                        <span className="w-5 h-5 rounded-full bg-primary/15 text-primary flex items-center justify-center flex-shrink-0">
                            <Check className="w-3.5 h-3.5" />
                        </span>
                        {perk}
                    </li>
                ))}
            </ul>

            {/* Plan cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {PLANS.map((plan) => {
                    const active = selected === plan.id;
                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => setSelected(plan.id)}
                            className={`relative text-left p-5 rounded-2xl border transition-all ${
                                active
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : "border-border bg-card hover:border-muted-foreground/40"
                            }`}
                        >
                            {plan.badge && (
                                <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                    {plan.badge}
                                </span>
                            )}
                            <div className="flex items-center gap-2 mb-3">
                                <span
                                    className={`w-4 h-4 rounded-full border flex items-center justify-center ${
                                        active ? "bg-primary border-primary text-primary-foreground" : "border-border"
                                    }`}
                                >
                                    {active && <Check className="w-3 h-3" />}
                                </span>
                                <span className="text-sm font-bold text-foreground">{plan.name}</span>
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-2xl font-bold text-foreground">{plan.price}</span>
                                <span className="text-xs text-muted-foreground">{plan.cadence}</span>
                            </div>
                            {plan.subtitle && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{plan.subtitle}</p>
                            )}
                        </button>
                    );
                })}
            </div>

            {error && (
                <p className="text-red-400/90 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    {error}
                </p>
            )}

            <button
                onClick={handleContinue}
                disabled={submitting || !accessToken}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
                {submitting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment…
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" /> Continue to payment
                    </>
                )}
            </button>

            <p className="text-center text-xs text-muted-foreground">
                You'll be redirected to a secure payment page. Cancel anytime from your profile.
            </p>
        </div>
    );
}
