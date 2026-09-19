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
        subtitle: "Billed once a year. Best value.",
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
