import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { initiatePayment, type PaymentPlan } from "@/lib/api";
import { plansFor, PRICE_EXTRAS_NOTE } from "@/lib/plans";
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
        if (submitting || !accessToken) return;
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
                {plans.map((plan) => {
                    const active = selected === plan.id;
                    return (
                        <button
                            key={plan.id}
                            type="button"
                            onClick={() => setPicked(plan.id)}
                            disabled={submitting}
                            className={`relative text-left p-5 rounded-2xl border transition-all disabled:opacity-60 ${
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

            <p className="text-xs text-muted-foreground leading-relaxed text-center">
                {PRICE_EXTRAS_NOTE}
            </p>

            {error && (
                <p className="text-red-700 dark:text-red-400/90 text-sm bg-red-500/10 border border-red-500/20 rounded-xl p-3 text-center">
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

            {submitting && (
                <button
                    type="button"
                    onClick={handleCancel}
                    className="block w-full text-sm text-muted-foreground hover:text-foreground"
                >
                    Cancel
                </button>
            )}

            <p className="text-center text-xs text-muted-foreground">
                You'll be redirected to a secure payment page. Cancel anytime from your profile.
            </p>
        </div>
    );
}
