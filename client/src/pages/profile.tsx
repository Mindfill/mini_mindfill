import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import AppSidebar from "@/components/sidebar/AppSidebar";
import { fetchProfile, updateProfile, cancelSubscription } from "@/lib/api";
import { useSubscription } from "@/hooks/use-subscription";
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
import { Loader2, User as UserIcon, Sparkles, CheckCircle2 } from "lucide-react";

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
    const [subStatus, setSubStatus] = useState<string | null>(null);
    const [periodEnd, setPeriodEnd] = useState<string | null>(null);
    const [cancelling, setCancelling] = useState(false);

    const userName = user?.user_metadata?.full_name || user?.email || "User";
    const accessToken = session?.access_token || "";
    const { toast } = useToast();
    const { refresh: refreshSubscription } = useSubscription();
    const isPaid = subStatus === "active";

    const loadProfile = async () => {
        if (!session) return;
        setLoading(true);
        setError(null);
        try {
            const p = await fetchProfile(accessToken);
            setEmail(p.email);
            setFullName(p.full_name || "");
            setDob(p.date_of_birth || "");
            setSubStatus(p.subscription_status ?? "free");
            setPeriodEnd(p.current_period_end ?? null);
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
            await loadProfile();
            refreshSubscription();
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

    const formattedPeriodEnd = periodEnd
        ? new Date(periodEnd).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
        : null;

    if (authLoading || (loading && !hasLoaded)) {
        return (
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName || "Loading..."} activeItem="profile" onSignOut={handleSignOut} />
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
            <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
                <AppSidebar userName={userName} activeItem="profile" onSignOut={handleSignOut} />
                <div className="flex-1 flex items-center justify-center p-8">
                    <div className="bg-card border border-border rounded-2xl p-8 max-w-sm w-full text-center">
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
        <div className="h-[100dvh] w-full bg-background text-foreground flex overflow-hidden">
            <AppSidebar userName={userName} activeItem="profile" onSignOut={handleSignOut} />

            <div className="flex-1 overflow-y-auto">
                <main className="max-w-2xl mx-auto p-6 md:p-10 space-y-8">
                    {/* Header */}
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                            <UserIcon className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
                            <p className="text-muted-foreground text-sm">Manage your personal information</p>
                        </div>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSave} className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-6">
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

                    {/* Subscription / plan */}
                    <section className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
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
                                    You're on <span className="font-semibold">Pro</span>.
                                    {formattedPeriodEnd
                                        ? ` Your plan renews on ${formattedPeriodEnd}.`
                                        : ""}
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
                                                You'll keep Pro access until
                                                {formattedPeriodEnd ? ` ${formattedPeriodEnd}` : " the end of your billing period"},
                                                then move back to the free plan. You can re-subscribe anytime.
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
                </main>
            </div>
        </div>
    );
}
