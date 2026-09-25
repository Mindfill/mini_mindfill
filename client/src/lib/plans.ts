import type { PaymentPlan, UserType } from "@/lib/api";

/**
 * Plan catalogue, per account type. Prices are display-only — Paystack is the
 * source of truth for what's actually charged, so EDIT THESE if the live
 * plans change. Both the onboarding paywall and /upgrade read from here, so
 * the two can't drift apart.
 */
export interface PlanInfo {
    id: PaymentPlan;
    name: string;
    price: string;
    cadence: string;
    /** Optional badge, e.g. savings vs monthly. */
    badge?: string;
    subtitle?: string;
}

/**
 * PRICING IS NOT SET YET.
 *
 * While this is true, no price is shown anywhere and no checkout can be
 * started: pilot users get in with an access code instead. The real figures
 * below are left in place deliberately — they are the pre-pilot guess, kept so
 * that turning pricing back on is this one flag plus whatever the willingness-
 * to-pay research says the numbers should actually be.
 *
 * To re-enable pricing:
 *   1. set PRICING_TBD = false
 *   2. update the amounts in UNIVERSITY_PLANS / SECONDARY_PLANS to the real
 *      Paystack ones (Paystack is the source of truth for what's charged)
 *   3. restore the savings badges and the yearly "Best value" subtitles
 *   4. re-enable the /payments/initiate guard in the backend
 *      (app/routers/payments.py — PAYMENTS_ENABLED)
 */
export const PRICING_TBD = true;

/** Shown in place of every amount while PRICING_TBD. */
export const TBD_PRICE_LABEL = "To be decided";

/** Replaces PRICE_EXTRAS_NOTE while PRICING_TBD — there is no price to add VAT to. */
export const TBD_PRICING_NOTE =
    "We're still working out what this should cost. Nothing is on sale yet — use the access code you were given to get in.";

/**
 * What a plan card actually renders. While PRICING_TBD this strips the amount
 * and the savings badge, since a "Save 33%" badge is itself a claim about
 * prices we haven't set.
 */
export function displayPlan(plan: PlanInfo): PlanInfo {
    if (!PRICING_TBD) return plan;
    return { ...plan, price: TBD_PRICE_LABEL, badge: undefined };
}

/**
 * Shown wherever a price is. Paystack adds VAT and its processing fee on its
 * own checkout page, so the amount there is a little above the figure we
 * print — this says so plainly beforehand rather than letting it land as a
 * surprise. Keep it factual and low-key; it is not a warning.
 */
export const PRICE_EXTRAS_NOTE =
    "Prices exclude VAT and payment processing fees. These are added at checkout, so the final amount is slightly higher.";

export const UNIVERSITY_PLANS: PlanInfo[] = [
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
        // "Best value" is a claim about a price we haven't set — restore it
        // alongside the real amounts when PRICING_TBD goes false.
        subtitle: "Billed once a year.",
    },
];

export const SECONDARY_PLANS: PlanInfo[] = [
    { id: "secondary_individual_monthly", name: "Individual", price: "₦5,000", cadence: "per month" },
    { id: "secondary_individual_yearly", name: "Individual", price: "₦40,000", cadence: "per year", badge: "Save 33%" },
    // "Up to 3" = 1 owner + 2 members, enforced by the can_add_member RPC.
    {
        id: "secondary_family_monthly",
        name: "Family",
        price: "₦10,000",
        cadence: "per month",
        subtitle: "Up to 3 users, one subscription.",
    },
    {
        id: "secondary_family_yearly",
        name: "Family",
        price: "₦80,000",
        cadence: "per year",
        badge: "Save 33%",
        subtitle: "Up to 3 users, one subscription.",
    },
];

export const UNIVERSITY_PERKS = [
    "Unlimited AI chat & explanations",
    "Unlimited quizzes & flashcards",
    "Concept visualizations",
    "No credit limits",
];

export const SECONDARY_PERKS = [
    "Every chapter unlocked",
    "Your AI tutor for every lesson",
    "Family plan: up to 3 users on one subscription",
];

/**
 * The short name of the plan someone is on — "Pro", "Individual", "Family" —
 * for the profile's Plan & billing card. Falls back by account type when the
 * plan id isn't known (e.g. a family member, whose row may not carry one).
 */
export function planDisplayName(planType: string | null | undefined, userType: UserType | null): string {
    // Promo grants that carry no specific plan are stored as "pilot". Name it
    // for what it is rather than falling through to "Paid", which is both
    // vague and untrue — nobody paid for it.
    if (planType === "pilot") return "Pilot access";
    const plan = [...UNIVERSITY_PLANS, ...SECONDARY_PLANS].find((p) => p.id === planType);
    if (plan) return plan.id.startsWith("pro_") ? "Pro" : plan.name;
    return userType === "secondary" ? "Paid" : "Pro";
}

/** Secondary accounts get secondary plans; everyone else sees Pro. */
export function plansFor(userType: UserType | null): {
    plans: PlanInfo[];
    perks: string[];
    defaultPlan: PaymentPlan;
} {
    if (userType === "secondary") {
        return { plans: SECONDARY_PLANS, perks: SECONDARY_PERKS, defaultPlan: "secondary_individual_yearly" };
    }
    return { plans: UNIVERSITY_PLANS, perks: UNIVERSITY_PERKS, defaultPlan: "pro_yearly" };
}
