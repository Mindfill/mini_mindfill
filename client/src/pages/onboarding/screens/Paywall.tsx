import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Check, Loader2, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    fetchPaywallStatus,
    initiatePayment,
    completeOnboarding,
    redeemPromoCode,
    PromoCodeError,
    PaymentPlan,
} from "@/lib/api";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ScreenProps } from "../utils";

interface PlanInfo {
    id: PaymentPlan;
    name: string;
    price: string;
    cadence: string;
    badge?: string;
}

const PLANS: PlanInfo[] = [
    { id: "secondary_individual_monthly", name: "Individual", price: "₦5,000", cadence: "per month" },
    { id: "secondary_individual_yearly", name: "Individual", price: "₦40,000", cadence: "per year", badge: "Save 33%" },
    { id: "secondary_family_monthly", name: "Family", price: "₦10,000", cadence: "per month" },
    { id: "secondary_family_yearly", name: "Family", price: "₦80,000", cadence: "per year", badge: "Save 33%" },
];

export default function Paywall({ accessToken, collected }: ScreenProps) {
    const [, navigate] = useLocation();
    const { refresh: refreshProfile } = useUserProfile();
    const [checkingMembership, setCheckingMembership] = useState(true);
    const [isMember, setIsMember] = useState(false);
    const [ownerName, setOwnerName] = useState<string | null>(null);

    const [selectedPlan, setSelectedPlan] = useState<PaymentPlan>("secondary_individual_yearly");
    const [payingOrSkipping, setPayingOrSkipping] = useState(false);
    const [payError, setPayError] = useState<string | null>(null);

    const [promoOpen, setPromoOpen] = useState(false);
    const [promoCode, setPromoCode] = useState("");
    const [redeemingPromo, setRedeemingPromo] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);

    useEffect(() => {
        fetchPaywallStatus(accessToken)
            .then((res) => {
                setIsMember(res.is_member);
                setOwnerName(res.owner_name);
            })
            .catch((err) => console.error("Failed to check paywall status:", err))
            .finally(() => setCheckingMembership(false));
    }, [accessToken]);

    const handleMemberContinue = async () => {
        if (payingOrSkipping) return;
        setPayingOrSkipping(true);
        try {
            await completeOnboarding(accessToken);
            await refreshProfile();
            navigate("/dashboard");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setPayingOrSkipping(false);
        }
    };

    const handlePay = async () => {
        if (payingOrSkipping) return;
        setPayingOrSkipping(true);
        setPayError(null);
        try {
            // Must run before initiatePayment: the onboarding_gate middleware
            // 403s /payments/initiate until onboarding_completed is true, and
            // onboarding is considered done the moment someone reaches this
            // action — independent of payment outcome.
            await completeOnboarding(accessToken);
            const { payment_url } = await initiatePayment(selectedPlan, accessToken);
            window.location.href = payment_url;
        } catch (err) {
            console.error("Failed to start checkout:", err);
            setPayError("Couldn't start checkout. Please try again.");
            setPayingOrSkipping(false);
        }
    };

    const handleFreeChapter = async () => {
        if (payingOrSkipping) return;
        setPayingOrSkipping(true);
        try {
            await completeOnboarding(accessToken);
            await refreshProfile();
            // Straight into the next lesson of the free chapter (Ch00).
            navigate("/secondary/start");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setPayingOrSkipping(false);
        }
    };

    const handleRedeemPromo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promoCode.trim() || redeemingPromo) return;
        setRedeemingPromo(true);
        setPromoError(null);
        try {
            await redeemPromoCode(promoCode.trim(), accessToken);
            await refreshProfile();
            navigate("/dashboard");
        } catch (err) {
            if (err instanceof PromoCodeError) {
                setPromoError(err.message);
            } else {
                console.error("Failed to redeem promo code:", err);
                setPromoError("Something went wrong — please try again.");
            }
        } finally {
            setRedeemingPromo(false);
        }
    };

    if (checkingMembership) {
        return <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />;
    }

    if (isMember) {
        return (
            <div className="space-y-8">
                <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                    You're all set{ownerName ? ` — ${ownerName} has got you covered.` : "."}
                </h1>
                <Button size="lg" onClick={handleMemberContinue} disabled={payingOrSkipping} className="w-full gap-2">
                    {payingOrSkipping && <Loader2 className="w-4 h-4 animate-spin" />}
                    Let's go →
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {collected.fullName ? `${collected.fullName}, you're ready.` : "You're ready."} Let's get you in.
            </h1>

            <div className="grid grid-cols-2 gap-2.5">
                {PLANS.map((plan) => {
                    const active = selectedPlan === plan.id;
                    return (
                        <button
                            key={plan.id}
                            onClick={() => setSelectedPlan(plan.id)}
                            className={`text-left p-4 rounded-2xl border transition-all ${
                                active ? "border-primary bg-primary/5 ring-1 ring-primary" : "border-border bg-card"
                            }`}
                        >
                            {/* Badge sits inline after the name and wraps to its own
                                line if the card is too narrow — never overlaps. */}
                            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                                <span
                                    className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                                        active ? "bg-primary border-primary" : "border-border"
                                    }`}
                                >
                                    {active && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                </span>
                                <span className="text-xs font-bold">{plan.name}</span>
                                {plan.badge && (
                                    <span className="text-[10px] font-bold uppercase tracking-wider bg-primary text-primary-foreground px-2 py-0.5 rounded-full whitespace-nowrap">
                                        {plan.badge}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-baseline gap-1">
                                <span className="text-lg font-bold">{plan.price}</span>
                                <span className="text-[11px] text-muted-foreground">{plan.cadence}</span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {payError && <p className="text-sm text-red-400">{payError}</p>}

            <Button size="lg" onClick={handlePay} disabled={payingOrSkipping} className="w-full gap-2">
                {payingOrSkipping && <Loader2 className="w-4 h-4 animate-spin" />}
                <Sparkles className="w-4 h-4" /> Continue to payment
            </Button>

            <div className="space-y-3 pt-2 border-t border-border">
                {!promoOpen ? (
                    <button
                        onClick={() => setPromoOpen(true)}
                        className="text-sm text-muted-foreground hover:text-foreground pt-3"
                    >
                        Have a school code?
                    </button>
                ) : (
                    <form onSubmit={handleRedeemPromo} className="flex gap-2 pt-3">
                        <Input
                            value={promoCode}
                            onChange={(e) => setPromoCode(e.target.value)}
                            placeholder="Enter code"
                            disabled={redeemingPromo}
                            className="flex-1 h-11"
                        />
                        <Button type="submit" disabled={!promoCode.trim() || redeemingPromo} className="gap-2 h-11">
                            {redeemingPromo && <Loader2 className="w-4 h-4 animate-spin" />}
                            Apply
                        </Button>
                    </form>
                )}
                {promoError && <p className="text-sm text-red-400">{promoError}</p>}

                <button
                    onClick={handleFreeChapter}
                    disabled={payingOrSkipping}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground"
                >
                    Start with the free chapter first →
                </button>
            </div>
        </div>
    );
}
