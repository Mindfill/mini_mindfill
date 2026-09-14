import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar, { deriveVariant } from "@/components/sidebar/AppSidebar";
import AnimatedGradientBg from "@/components/ui/animated-gradient-bg";
import { fetchProfile, updateProfile, cancelSubscription, linkParent } from "@/lib/api";
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

    const accessToken = session?.access_token || "";
    const { toast } = useToast();
    const { isPaid } = useCredits();
    const { userType, role, fullName: onboardingFullName } = useUserProfile();
    const sidebarVariant = deriveVariant(userType, role);
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

    const handleCancelSubscription = async () => {
        if (!session || cancelling) return;
        setCancelling(true);
        try {
            await cancelSubscription(accessToken);
            toast({
                title: "Subscription cancelled",
                description: "You'll keep Pro access until the end of your billing period.",
            });
        } catch (err) {
            console.error("Failed to cancel subscription:", err);
            toast({
                variant: "destructive",
                title: "Couldn't cancel",
                description: "Please try again in a moment.",
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
                <div className="flex-1 flex flex-col items-center justify-center bg-background">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-xs font-bold tracking-[0.2em] uppercase text-muted-foreground animate-pulse">
                        Loading Profile...
                    </p>
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

            <div className="flex-1 overflow-y-auto relative">
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

                    {/* Subscription / plan — parents aren't part of the credit system */}
                    {userType !== "parent" && (
                    <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-lg font-semibold tracking-tight">Plan &amp; billing</h2>
                                <p className="text-muted-foreground text-sm">Manage your subscription.</p>
                            </div>
                            <span
                                className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-full ${
                                    isPaid
                                        ? "bg-green-500/10 text-green-500"
                                        : "bg-muted text-muted-foreground"
                                }`}
                            >
                                {isPaid ? <CheckCircle2 className="w-3.5 h-3.5" /> : null}
                                {isPaid ? "Pro" : "Free"}
                            </span>
                        </div>

                        {isPaid ? (
                            <div className="space-y-4">
                                <p className="text-sm text-foreground/90">
                                    You're on <span className="font-semibold">Pro</span> with unlimited access.
                                </p>

                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="outline" className="border-red-500/30 text-red-400 hover:text-red-400 hover:bg-red-500/10">
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
                                    You're on the <span className="font-semibold">Free</span> plan. Upgrade to Pro for
                                    unlimited chat, quizzes, flashcards and visualizations.
                                </p>
                                <Button onClick={() => navigate("/upgrade")} className="gap-2">
                                    <Sparkles className="w-4 h-4" /> Upgrade to Pro
                                </Button>
                            </div>
                        )}
                    </section>
                    )}

                    {/* Family plan members (secondary school only — renders nothing if not applicable) */}
                    {userType === "secondary" && accessToken && (
                        <FamilyMembersSection accessToken={accessToken} />
                    )}

                    {/* Parent linking (not applicable to parent accounts themselves) */}
                    {userType !== "parent" && (
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
                                <div className="flex items-center gap-2 text-sm text-green-500 bg-green-500/10 rounded-xl px-4 py-3">
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
