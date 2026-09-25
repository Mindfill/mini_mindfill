import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
    initiatePayment,
    redeemPromoCode,
    PromoCodeError,
    type PaymentPlan,
} from "@/lib/api";
import { plansFor, displayPlan, PRICE_EXTRAS_NOTE, PRICING_TBD, TBD_PRICING_NOTE } from "@/lib/plans";
import { Check, Loader2, Sparkles } from "lucide-react";

interface PlanSelectorProps {
    /** Called after a successful initiate, right before redirecting away. */
    onRedirect?: () => void;
}

export default function PlanSelector({ onRedirect }: PlanSelectorProps) {
    const { session } = useAuth();
    const accessToken = session?.access_token || "";
    // Which catalogue to show depends on the account type — secondary
    // students must never be offered (or able to buy) the uni Pro plans.
    const { userType, loading: profileLoading } = useUserProfile();
    const { plans, perks, defaultPlan } = plansFor(userType);

    const [picked, setPicked] = useState<PaymentPlan | null>(null);
    // Fall back to the default until the user picks — and if the catalogue
    // changed under them (profile resolved late), don't keep a plan that
    // isn't on screen.
    const selected = picked && plans.some((p) => p.id === picked) ? picked : defaultPlan;
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // See Paywall.tsx: lets a stuck or accidental checkout be cancelled, and
    // resets if the page is restored from the back/forward cache.
    const attemptRef = useRef(0);
    const redirectingRef = useRef(false);

    // Access codes are a secondary-school thing: redemption grants a secondary
    // plan, which is read by get_subscription_access(). University access is
    // gated on user_credits instead, which redemption never touches — so a
    // code redeemed by a uni account succeeds and grants nothing. Don't offer
    // it to them.
    const promoAvailable = userType === "secondary";
    // Open by default while there is nothing to buy, since a code is then the
    // only way anyone gets in.
    const [promoOpen, setPromoOpen] = useState(PRICING_TBD);
    const [promoCode, setPromoCode] = useState("");
    const [redeemingPromo, setRedeemingPromo] = useState(false);
    const [promoError, setPromoError] = useState<string | null>(null);
    const [promoDone, setPromoDone] = useState(false);

    useEffect(() => {
        const onPageShow = (e: PageTransitionEvent) => {
            if (e.persisted) {
                attemptRef.current += 1;
                redirectingRef.current = false;
                setSubmitting(false);
            }
        };
        window.addEventListener("pageshow", onPageShow);
        return () => window.removeEventListener("pageshow", onPageShow);
    }, []);

    const handleContinue = async () => {
        // Belt and braces: the button is disabled while PRICING_TBD, but this
        // is the thing that would actually send someone to Paystack.
        if (PRICING_TBD || submitting || !accessToken) return;
        const attempt = ++attemptRef.current;
        setSubmitting(true);
        setError(null);
        try {
            const { payment_url } = await initiatePayment(selected, accessToken);
            if (attempt !== attemptRef.current) return; // cancelled meanwhile
            onRedirect?.();
            redirectingRef.current = true;
            window.location.href = payment_url;
        } catch (err) {
            if (attempt !== attemptRef.current) return;
            console.error("Failed to start checkout:", err);
            setError("Couldn't start checkout. Please try again.");
            setSubmitting(false);
        }
    };

    const handleCancel = () => {
        attemptRef.current += 1;
        if (redirectingRef.current) window.stop();
        redirectingRef.current = false;
        setSubmitting(false);
    };

    const handleRedeemPromo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!promoCode.trim() || redeemingPromo || !accessToken) return;
        setRedeemingPromo(true);
        setPromoError(null);
        try {
            await redeemPromoCode(promoCode.trim(), accessToken);
            setPromoDone(true);
            // A reload rather than a context refresh: redemption changes the
            // subscription, the credits row and the onboarding flag at once,
            // and those are read by three separate providers plus the backend
            // middleware. Re-reading everything from scratch is the only way to
            // be sure nothing is left showing the pre-redemption state.
            window.location.reload();
        } catch (err) {
            if (err instanceof PromoCodeError) {
                setPromoError(err.message);
            } else {
                console.error("Failed to redeem promo code:", err);
                setPromoError("Something went wrong — please try again.");
            }
            setRedeemingPromo(false);
        }
    };

    // Don't guess the catalogue while the profile is loading — showing Pro
    // prices to a secondary student, even briefly, is the bug this fixes.
    if (profileLoading && !userType) {
        return <Loader2 className="w-6 h-6 animate-spin mx-auto text-muted-foreground" />;
    }

    return (
        <div className="space-y-6">
            {/* Perks */}
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {perks.map((perk) => (
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
                {plans.map((source) => {
                    const plan = displayPlan(source);
                    // Nothing is selectable while there is nothing to buy — the
                    // cards stay up so people can see what the plans will be.
                    const active = !PRICING_TBD && selected === plan.id;
                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => setPicked(plan.id)}
                            disabled={PRICING_TBD || submitting}
                            aria-disabled={PRICING_TBD || submitting}
                            className={`relative text-left p-5 rounded-2xl border transition-all ${
                                PRICING_TBD
                                    ? "border-border bg-card opacity-70 cursor-not-allowed"
                                    : "disabled:opacity-60"
                            } ${
                                active
                                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                                    : PRICING_TBD
                                      ? ""
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
                            <div className="flex items-baseline gap-1 flex-wrap">
                                <span
                                    className={`font-bold ${
                                        PRICING_TBD ? "text-base text-muted-foreground italic" : "text-2xl text-foreground"
                                    }`}
                                >
                                    {plan.price}
                                </span>
                                <span className="text-xs text-muted-foreground">{plan.cadence}</span>
                            </div>
                            {plan.subtitle && (
                                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{plan.subtitle}</p>
                            )}
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-muted-foreground leading-relaxed text-center">
                {PRICING_TBD ? TBD_PRICING_NOTE : PRICE_EXTRAS_NOTE}
            </p>

            {error && (
                <p className="text-red-700 dark:text-red-400/90 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
                    {error}
                </p>
            )}

            <button
                onClick={handleContinue}
                disabled={PRICING_TBD || submitting || !accessToken}
                className={`w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 ${
                    PRICING_TBD ? "cursor-not-allowed" : "hover:brightness-110"
                }`}
            >
                {PRICING_TBD ? (
                    <>
                        <Sparkles className="w-4 h-4" /> Payment coming soon
                    </>
                ) : submitting ? (
                    <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Redirecting to payment…
                    </>
                ) : (
                    <>
                        <Sparkles className="w-4 h-4" /> Continue to payment
                    </>
                )}
            </button>

            {!PRICING_TBD && submitting && (
                <button
                    type="button"
                    onClick={handleCancel}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground"
                >
                    Cancel
                </button>
            )}

            {promoAvailable && (
            <div className="space-y-3 pt-4 border-t border-border">
                {!promoOpen ? (
                    <button
                        type="button"
                        onClick={() => setPromoOpen(true)}
                        disabled={submitting}
                        className="block w-full text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                        Have an access code?
                    </button>
                ) : (
                    <form onSubmit={handleRedeemPromo} className="space-y-2">
                        <label htmlFor="promo-code" className="block text-sm font-semibold">
                            Have an access code?
                        </label>
                        <div className="flex gap-2">
                            <Input
                                id="promo-code"
                                value={promoCode}
                                onChange={(e) => setPromoCode(e.target.value)}
                                placeholder="Enter code"
                                autoCapitalize="characters"
                                autoCorrect="off"
                                spellCheck={false}
                                disabled={redeemingPromo || promoDone}
                                className="flex-1 h-11"
                            />
                            <Button
                                type="submit"
                                disabled={!promoCode.trim() || redeemingPromo || promoDone}
                                className="gap-2 h-11"
                            >
                                {(redeemingPromo || promoDone) && <Loader2 className="w-4 h-4 animate-spin" />}
                                Apply
                            </Button>
                        </div>
                    </form>
                )}

                {promoError && (
                    <p className="text-sm text-red-700 dark:text-red-400">{promoError}</p>
                )}
                {promoDone && (
                    <p className="text-sm text-green-700 dark:text-green-400">
                        Code accepted — setting up your access…
                    </p>
                )}
            </div>
            )}

            {!PRICING_TBD && (
                <p className="text-center text-xs text-muted-foreground">
                    You'll be redirected to a secure payment page. Cancel anytime from your profile.
                </p>
            )}
        </div>
    );
}
