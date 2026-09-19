import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar, { deriveVariant } from "@/components/sidebar/AppSidebar";
import TechcessLoader from "@/components/brand/TechcessLoader";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import {
    fetchProfile,
    updateProfile,
    cancelSubscription,
    linkParent,
    fetchMySubscription,
    type MySubscription,
} from "@/lib/api";
import { useCredits } from "@/hooks/use-credits";
import { useUserProfile } from "@/hooks/use-user-profile";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, User as UserIcon, Sparkles, CheckCircle2, UserPlus, Mail } from "lucide-react";
import FamilyMembersSection from "@/components/billing/FamilyMembersSection";
import type { Variant } from "@/components/sidebar/AppSidebar";

/**
 * Which profile sections exist for each account type.
 *
 * Previously each section carried its own `userType !== "parent"` ternary,
 * which meant school admins were shown Plan & billing they have no use for —
 * and `userType` alone cannot decide it, because a dual-role account (David's
 * own test account) is user_type=secondary WITH role=school_admin. Keying off
 * deriveVariant() makes role win, exactly as it does for the sidebar.
 *
 * Parent linking is deliberately secondary-only. The parent dashboard can
 * display university children, and POST /profile/link-parent still accepts
 * them, so this hides the entry point rather than removing the capability —
 * existing uni-student parent links keep working.
 */
type ProfileCapabilities = {
    billing: boolean;
    family: boolean;
    linkParent: boolean;
};

const PROFILE_CAPABILITIES: Record<Variant, ProfileCapabilities> = {
    university: { billing: true, family: false, linkParent: false },
    secondary: { billing: true, family: true, linkParent: true },
    parent: { billing: false, family: false, linkParent: false },
    school_admin: { billing: false, family: false, linkParent: false },
};

// deriveVariant() folds platform admins into "university" for navigation
// purposes, so they need naming separately here — an ops account has no plan
// of its own to manage.
const ADMIN_CAPABILITIES: ProfileCapabilities = {
    billing: false,
    family: false,
    linkParent: false,
};

export default function Profile() {
    const { session, user, isLoading: authLoading, signOut: supabaseSignOut } = useAuth();
    const [, navigate] = useLocation();

    const [loading, setLoading] = useState(true);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const [email, setEmail] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [dob, setDob] = useState("");
    const [cancelling, setCancelling] = useState(false);
    const [subscription, setSubscription] = useState<MySubscription | null>(null);

    const accessToken = session?.access_token || "";
    const { toast } = useToast();
    const { isPaid } = useCredits();
    const { userType, role, fullName: onboardingFullName } = useUserProfile();
    const sidebarVariant = deriveVariant(userType, role);
    const caps = role === "admin" ? ADMIN_CAPABILITIES : PROFILE_CAPABILITIES[sidebarVariant];
    // Prefer the name saved during onboarding/profile edits — falls back to
    // auth metadata/email only while that hasn't loaded yet, so this never
    // flips to the email-derived name after the page has finished loading.
    const userName = fullName || onboardingFullName || user?.user_metadata?.full_name || user?.email || "User";

    const [parentEmail, setParentEmail] = useState("");
    const [linkingParent, setLinkingParent] = useState(false);
    const [parentLinkStatus, setParentLinkStatus] = useState<"linked" | "invited" | null>(null);

    const loadProfile = async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const p = await fetchProfile(accessToken);
            setEmail(p.email);
            setFullName(p.full_name || "");
            setDob(p.date_of_birth || "");
        } catch (err) {
            console.error("Failed to load profile:", err);
            setError("Could not load your profile");
        } finally {
            setLoading(false);
            setHasLoaded(true);
        }
    };

    useEffect(() => {
        if (!authLoading && !session) {
            navigate("/login");
            return;
        }
        if (session) loadProfile();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [session, authLoading, navigate]);

    useEffect(() => {
        document.title = "Profile | TECHCESS";
    }, []);

    const handleSignOut = async () => {
        await supabaseSignOut();
        navigate("/login");
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || saving) return;
        setSaving(true);
        try {
            const updated = await updateProfile(
                { full_name: fullName.trim(), date_of_birth: dob || null },
                accessToken
            );
            setFullName(updated.full_name || "");
            setDob(updated.date_of_birth || "");
            toast({ title: "Profile saved", description: "Your changes have been saved." });
        } catch (err: any) {
            console.error("Failed to save profile:", err);
            toast({
                variant: "destructive",
                title: "Couldn't save profile",
                description: "Please try again.",
            });
        } finally {
            setSaving(false);
        }
    };

    // The billing panel needs to know whether a cancellation is pending, which
    // neither the profile row nor useCredits knows about.
    const loadSubscription = async () => {
        if (!accessToken || !caps.billing) return;
        try {
            setSubscription(await fetchMySubscription(accessToken));
        } catch (err) {
            console.error("Failed to load subscription state:", err);
        }
    };

    useEffect(() => {
        loadSubscription();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken, caps.billing]);

    const endsOn = subscription?.current_period_end
        ? new Date(subscription.current_period_end).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
          })
        : null;

    const handleCancelSubscription = async () => {
        if (!session || cancelling) return;
        setCancelling(true);
        try {
            const { access_until } = await cancelSubscription(accessToken);
            // Name the actual date where we have it — "end of your billing
            // period" leaves people unsure whether they just lost access.
            const until = access_until
                ? new Date(access_until).toLocaleDateString(undefined, {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                  })
                : null;
            toast({
                title: "Subscription cancelled",
                description: until
                    ? `You won't be charged again. Your access continues until ${until}.`
                    : "You won't be charged again. You'll keep access until the end of the period you've paid for.",
            });
            // Deliberately no credits refresh: access continues until the end
            // of the paid period, so nothing about their plan changes today.
            // The panel does need to flip to its "resume" state though.
            await loadSubscription();
        } catch (err) {
            console.error("Failed to cancel subscription:", err);
            toast({
                variant: "destructive",
                title: "Couldn't cancel",
                description: err instanceof Error ? err.message : "Please try again in a moment.",
            });
        } finally {
            setCancelling(false);
        }
    };

    const handleLinkParent = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!session || linkingParent || !parentEmail.trim()) return;
        setLinkingParent(true);
        try {
            const res = await linkParent(parentEmail.trim(), accessToken);
            setParentLinkStatus(res.status);
            toast({
                title: res.status === "linked" ? "Parent linked" : "Invite sent",
                description:
                    res.status === "linked"
                        ? "They can now see your progress from their dashboard."
                        : "We've emailed them an invite to create a free parent account.",
            });
        } catch (err) {
            console.error("Failed to link parent:", err);
            toast({
                variant: "destructive",
                title: "Couldn't link parent",
                description: "Please check the email and try again.",
            });
        } finally {
            setLinkingParent(false);
        }
    };

    if (authLoading || (loading && !hasLoaded)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar userName={userName || "Loading..."} activeItem="profile" onSignOut={handleSignOut} variant={sidebarVariant} />
                <div className="flex-1 relative">
                    <TechcessLoader label="Loading your profile" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
                <AnimatedGradientBg />
                <AppSidebar userName={userName} activeItem="profile" onSignOut={handleSignOut} variant={sidebarVariant} />
                <div className="flex-1 flex items-center justify-center p-8 relative">
                    <div className="glass-panel rounded-2xl p-8 max-w-sm w-full text-center">
                        <h2 className="text-xl font-semibold mb-2">Unable to load profile</h2>
                        <p className="text-muted-foreground text-sm mb-6">There was a problem fetching your profile.</p>
                        <button
                            onClick={loadProfile}
                            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 py-2 rounded-xl font-medium transition-colors"
                        >
                            Retry
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full bg-background text-foreground flex flex-col md:flex-row overflow-hidden relative">
            <AnimatedGradientBg />
            <AppSidebar userName={userName} activeItem="profile" onSignOut={handleSignOut} variant={sidebarVariant} />

            <div className="flex-1 min-w-0 overflow-y-auto relative">
                <main className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <UserIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="font-display text-2xl font-semibold tracking-tight">Profile</h1>
                            <p className="text-muted-foreground text-sm">Manage your personal information</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSave} className="glass-panel rounded-3xl p-6 md:p-8 space-y-6">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email</Label>
                            <Input id="email" value={email || ""} disabled readOnly />
                            <p className="text-xs text-muted-foreground">Your email is managed by your account and can't be changed here.</p>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="full-name">Full Name</Label>
                            <Input
                                id="full-name"
                                value={fullName}
                                onChange={(e) => setFullName(e.target.value)}
                                placeholder="e.g., Ada Lovelace"
                                disabled={saving}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="dob">Date of Birth</Label>
                            <Input
                                id="dob"
                                type="date"
                                value={dob}
                                onChange={(e) => setDob(e.target.value)}
                                disabled={saving}
                            />
                        </div>

                        <div className="pt-2 flex justify-end">
                            <Button type="submit" disabled={saving} className="gap-2">
                                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </div>
                    </form>

                    {/* Subscription / plan — see PROFILE_CAPABILITIES */}
                    {caps.billing && (
                    <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Plan &amp; billing</h2>
                                <p className="text-muted-foreground text-sm">Manage your subscription.</p>
                            </div>
                            <span
                                className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                    isPaid && subscription?.cancel_at_period_end
                                        ? "bg-amber-500/10 text-amber-700 dark:text-amber-400"
                                        : isPaid
                                          ? "bg-green-500/10 text-green-700 dark:text-green-400"
                                          : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {isPaid && !subscription?.cancel_at_period_end ? (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                ) : null}
                                {isPaid
                                    ? subscription?.cancel_at_period_end
                                        ? "Pro · ending"
                                        : "Pro"
                                    : "Free"}
                            </span>
                        </div>

                        {isPaid && subscription?.cancel_at_period_end ? (
                            /* Cancelled but still inside the period they paid for:
                               billing has stopped, access hasn't. */
                            <div className="space-y-4">
                                <p className="text-sm text-foreground/90">
                                    Your plan is set to end{endsOn ? ` on ${endsOn}` : " at the end of this billing period"}.
                                    You keep full access until then, and you won't be charged again.
                                </p>
                                <Button onClick={() => navigate("/upgrade")} className="gap-2">
                                    <Sparkles className="w-4 h-4" /> Subscribe again
                                </Button>
                                {/* Paystack cannot re-enable a disabled subscription
                                    ("Subscription has been cancelled, and cannot be
                                    reactivated"), so coming back always means a NEW
                                    subscription — which starts billing immediately.
                                    Say so rather than letting them discover it. */}
                                <p className="text-xs text-muted-foreground">
                                    Subscribing again starts a new billing period straight away
                                    {endsOn ? `, replacing the one that runs to ${endsOn}` : ""}.
                                </p>
                            </div>
                        ) : isPaid ? (
                            <div className="space-y-4">
                                <p className="text-sm text-foreground/90">
                                    You're on <span className="font-semibold">Pro</span> with unlimited access.
                                </p>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="border-red-500/30 text-red-700 dark:text-red-400 hover:text-red-400 hover:bg-red-500/10">
                                            Cancel subscription
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Cancel your Pro plan?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                You'll keep Pro access until the end of your billing period, then move
                                                back to the free plan. You can re-subscribe anytime.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel disabled={cancelling}>Keep Pro</AlertDialogCancel>
                                            <AlertDialogAction
                                                onClick={handleCancelSubscription}
                                                disabled={cancelling}
                                                className="bg-red-500 hover:bg-red-500/90 text-white gap-2"
                                            >
                                                {cancelling && <Loader2 className="w-4 h-4 animate-spin" />}
                                                Cancel subscription
                                            </AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-sm text-foreground/90">
                                    {subscription?.status === "cancelled" || subscription?.status === "expired" ? (
                                        <>
                                            Your Pro plan has ended and you're back on the{" "}
                                            <span className="font-semibold">Free</span> plan. Pick up where you left
                                            off whenever you're ready.
                                        </>
                                    ) : (
                                        <>
                                            You're on the <span className="font-semibold">Free</span> plan. Upgrade to
                                            Pro for unlimited chat, quizzes, flashcards and visualizations.
                                        </>
                                    )}
                                </p>
                                <Button onClick={() => navigate("/upgrade")} className="gap-2">
                                    <Sparkles className="w-4 h-4" />
                                    {subscription?.status === "cancelled" || subscription?.status === "expired"
                                        ? "Subscribe again"
                                        : "Upgrade to Pro"}
                                </Button>
                            </div>
                        )}
                    </section>
                    )}

                    {/* Family plan members — renders nothing if not applicable */}
                    {caps.family && accessToken && (
                        <FamilyMembersSection accessToken={accessToken} />
                    )}

                    {/* Parent linking — secondary only, see PROFILE_CAPABILITIES */}
                    {caps.linkParent && (
                        <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                                    <UserPlus className="w-5 h-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold tracking-tight">Add a parent or guardian</h2>
                                    <p className="text-muted-foreground text-sm">
                                        They'll be able to see your progress from their own dashboard.
                                    </p>
                                </div>
                            </div>

                            {parentLinkStatus && (
                                <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-500/10 rounded-xl px-4 py-3">
                                    <Mail className="w-4 h-4 flex-shrink-0" />
                                    {parentLinkStatus === "linked"
                                        ? "Linked — they can see your progress now."
                                        : "Invite sent — pending until they create a parent account."}
                                </div>
                            )}

                            <form onSubmit={handleLinkParent} className="flex flex-col sm:flex-row gap-3">
                                <Input
                                    type="email"
                                    value={parentEmail}
                                    onChange={(e) => setParentEmail(e.target.value)}
                                    placeholder="parent@example.com"
                                    disabled={linkingParent}
                                    className="flex-1"
                                />
                                <Button type="submit" disabled={linkingParent || !parentEmail.trim()} className="gap-2 sm:w-auto">
                                    {linkingParent && <Loader2 className="w-4 h-4 animate-spin" />}
                                    Link parent
                                </Button>
                            </form>
                        </section>
                    )}
                </main>
            </div>
        </div>
    );
}
