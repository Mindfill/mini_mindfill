import { useEffect, useRef, useState } from "react";
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
import { SECONDARY_PLANS as PLANS, PRICE_EXTRAS_NOTE } from "@/lib/plans";
import { ScreenProps } from "../utils";

export default function Paywall({ accessToken, collected }: ScreenProps) {
    const [, navigate] = useLocation();
    const { refresh: refreshProfile } = useUserProfile();
    const [checkingMembership, setCheckingMembership] = useState(true);
    const [isMember, setIsMember] = useState(false);
    const [ownerName, setOwnerName] = useState<string | null>(null);

    const [selectedPlan, setSelectedPlan] = useState<PaymentPlan>("secondary_individual_yearly");
    // Which action is in flight, if any. Only that action's button spins; the
    // others are blocked so two can't race, but "pay" can always be cancelled.
    const [pending, setPending] = useState<"pay" | "free" | "member" | null>(null);
    const payingOrSkipping = pending !== null;
    // Bumped on cancel, so a checkout request that resolves afterwards knows
    // it was abandoned and doesn't redirect.
    const payAttemptRef = useRef(0);
    const redirectingRef = useRef(false);
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

    // Coming back from Paystack with the browser's Back button can restore
    // this page from the back/forward cache with the spinner still frozen
    // mid-redirect. Start clean instead.
    useEffect(() => {
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                payAttemptRef.current += 1;
                redirectingRef.current = false;
                setPending(null);
            }
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    const handleMemberContinue = async () => {
        if (payingOrSkipping) return;
        setPending("member");
        try {
            await completeOnboarding(accessToken);
            await refreshProfile();
            navigate("/dashboard");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setPending(null);
        }
    };

    const handlePay = async () => {
        if (payingOrSkipping) return;
        const attempt = ++payAttemptRef.current;
        setPending("pay");
        setPayError(null);
        try {
            // Must run before initiatePayment: the onboarding_gate middleware
            // 403s /payments/initiate until onboarding_completed is true, and
            // onboarding is considered done the moment someone reaches this
            // action — independent of payment outcome.
            await completeOnboarding(accessToken);
            const { payment_url } = await initiatePayment(selectedPlan, accessToken);
            if (attempt !== payAttemptRef.current) return; // cancelled meanwhile
            redirectingRef.current = true;
            window.location.href = payment_url;
        } catch (err) {
            if (attempt !== payAttemptRef.current) return;
            console.error("Failed to start checkout:", err);
            setPayError("Couldn't start checkout. Please try again.");
            setPending(null);
        }
    };

    const handleCancelPay = () => {
        payAttemptRef.current += 1;
        // If the redirect has already been kicked off, abort it too. Only
        // then — window.stop() also kills any other in-flight requests.
        if (redirectingRef.current) window.stop();
        redirectingRef.current = false;
        setPending(null);
    };

    const handleFreeChapter = async () => {
        if (payingOrSkipping) return;
        setPending("free");
        try {
            await completeOnboarding(accessToken);
            await refreshProfile();
            // Straight into the next lesson of the free chapter (Ch00).
            navigate("/secondary/start");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setPending(null);
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
                    {pending === "member" && <Loader2 className="w-4 h-4 animate-spin" />}
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
                            disabled={payingOrSkipping}
                            className={`text-left p-4 rounded-2xl border transition-all disabled:opacity-60 ${
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
                            {plan.subtitle && (
                                <p className="text-[11px] text-muted-foreground mt-1 leading-snug">{plan.subtitle}</p>
                            )}
                        </button>
                    );
                })}
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">{PRICE_EXTRAS_NOTE}</p>

            {payError && <p className="text-sm text-red-700 dark:text-red-400">{payError}</p>}

            <Button size="lg" onClick={handlePay} disabled={payingOrSkipping} className="w-full gap-2">
                {pending === "pay" ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Opening secure checkout…
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" /> Continue to payment
                    </>
                )}
            </Button>
            {pending === "pay" && (
                <button
                    type="button"
                    onClick={handleCancelPay}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground"
                >
                    Cancel — pick a different option
                </button>
            )}

            <div className="space-y-3 pt-2 border-t border-border">
                {!promoOpen ? (
                    <button
                        onClick={() => setPromoOpen(true)}
                        disabled={payingOrSkipping}
                        className="text-sm text-muted-foreground hover:text-foreground pt-3 disabled:opacity-50"
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
                {promoError && <p className="text-sm text-red-700 dark:text-red-400">{promoError}</p>}

                <button
                    onClick={handleFreeChapter}
                    disabled={payingOrSkipping}
                    className="flex items-center justify-center gap-2 w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                    {pending === "free" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    Start with the free chapter first →
                </button>
            </div>
        </div>
    );
}
