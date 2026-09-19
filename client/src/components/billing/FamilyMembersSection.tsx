import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Users, X } from "lucide-react";
import {
    fetchSubscriptionMembers,
    inviteSubscriptionMember,
    removeSubscriptionMember,
    type MembersResponse,
} from "@/lib/api";

/**
 * Owner-only family-plan member management (Feature 01). Renders nothing if
 * the user isn't a family-plan owner — GET /subscriptions/members 403s for
 * everyone else, which we treat as "not applicable" rather than an error.
 */
export default function FamilyMembersSection({ accessToken }: { accessToken: string }) {
    const [data, setData] = useState<MembersResponse | null>(null);
    const [applicable, setApplicable] = useState(true);
    const [loading, setLoading] = useState(true);
    const [inviteEmail, setInviteEmail] = useState("");
    const [inviting, setInviting] = useState(false);
    const [removingId, setRemovingId] = useState<string | null>(null);
    const { toast } = useToast();

    const load = async () => {
        try {
            const res = await fetchSubscriptionMembers(accessToken);
            setData(res);
            setApplicable(true);
        } catch {
            setApplicable(false);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (accessToken) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inviteEmail.trim() || inviting) return;
        setInviting(true);
        try {
            const res = await inviteSubscriptionMember(inviteEmail.trim(), accessToken);
            toast({
                title: res.status === "resent" ? "Invite resent" : "Invite sent",
                description: `${inviteEmail.trim()} has 48 hours to accept.`,
            });
            setInviteEmail("");
            await load();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Couldn't send invite",
                description: err?.message || "Please try again.",
            });
        } finally {
            setInviting(false);
        }
    };

    const handleRemove = async (userId: string) => {
        setRemovingId(userId);
        try {
            await removeSubscriptionMember(userId, accessToken);
            toast({ title: "Member removed" });
            await load();
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Couldn't remove member",
                description: err?.message || "Please try again.",
            });
        } finally {
            setRemovingId(null);
        }
    };

    if (loading || !applicable) return null;

    const memberCount = (data?.members.length ?? 0) + (data?.pending_invites.length ?? 0);
    const atLimit = memberCount >= 2;

    return (
        <section className="bg-card border border-border rounded-3xl p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Users className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Family members</h2>
                    <p className="text-muted-foreground text-sm">
                        Your plan includes up to 2 additional members.
                    </p>
                </div>
            </div>

            {(data?.members.length ?? 0) > 0 && (
                <div className="space-y-2">
                    {data!.members.map((m) => (
                        <div
                            key={m.user_id}
                            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
                        >
                            <p className="text-sm font-medium">{m.full_name || "Member"}</p>
                            <Button
                                size="sm"
                                variant="ghost"
                                className="text-muted-foreground hover:text-destructive"
                                disabled={removingId === m.user_id}
                                onClick={() => handleRemove(m.user_id)}
                            >
                                {removingId === m.user_id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                    <X className="w-3.5 h-3.5" />
                                )}
                            </Button>
                        </div>
                    ))}
                </div>
            )}

            {(data?.pending_invites.length ?? 0) > 0 && (
                <div className="space-y-2">
                    {data!.pending_invites.map((inv) => (
                        <div
                            key={inv.invited_email}
                            className="flex items-center justify-between rounded-lg border border-dashed border-border/60 px-3 py-2.5"
                        >
                            <p className="text-sm text-muted-foreground">{inv.invited_email}</p>
                            <span className="text-xs text-muted-foreground uppercase tracking-wide">Pending</span>
                        </div>
                    ))}
                </div>
            )}

            {atLimit ? (
                <p className="text-sm text-muted-foreground">
                    You've used both member slots. Remove someone to invite a different person.
                </p>
            ) : (
                <form onSubmit={handleInvite} className="flex flex-col sm:flex-row gap-3">
                    <Input
                        type="email"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        placeholder="member@example.com"
                        disabled={inviting}
                        className="flex-1"
                    />
                    <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="gap-2 sm:w-auto">
                        {inviting && <Loader2 className="w-4 h-4 animate-spin" />}
                        Invite
                    </Button>
                </form>
            )}
        </section>
    );
}
