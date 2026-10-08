import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Smartphone } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { fetchDevices, deregisterDevice, type DeviceEntry } from "@/lib/api";
import { getDeviceToken } from "@/lib/device";
import DeviceList from "@/components/billing/DeviceList";

/**
 * Registered-devices management on the profile page.
 *
 * This is the page the device-limit copy has always pointed students at
 * ("Remove one from your profile to continue here") — it just never existed,
 * so a student over the cap had nowhere to go. `GET /devices` and
 * `DELETE /devices/{token}` were already built and unused.
 *
 * It also fixes a gap the app-wide DeviceLimitDialog can't: that dialog only
 * renders off `POST /devices/register`, which only runs on the SIGNED_IN
 * event, so a reload (INITIAL_SESSION — deliberately skipped in use-auth so
 * reloads don't churn the device token) leaves the student with no way back to
 * it. This section is reachable whenever they want it.
 */
export default function DevicesSection({ accessToken }: { accessToken: string }) {
    const { retryDeviceRegistration } = useAuth();
    const [devices, setDevices] = useState<DeviceEntry[] | null>(null);
    const [loadError, setLoadError] = useState(false);
    const [removingToken, setRemovingToken] = useState<string | null>(null);
    const { toast } = useToast();

    const load = async () => {
        try {
            setDevices(await fetchDevices(accessToken));
            setLoadError(false);
        } catch (err) {
            console.error("Failed to load devices:", err);
            setLoadError(true);
        }
    };

    useEffect(() => {
        if (accessToken) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [accessToken]);

    const handleRemove = async (deviceToken: string) => {
        setRemovingToken(deviceToken);
        try {
            await deregisterDevice(deviceToken, accessToken);
            // Freeing a slot doesn't put *this* browser in it. If the student is
            // here because this device was refused, claim the slot now — without
            // this they'd free a slot and still be locked out.
            await retryDeviceRegistration().catch(() => {});
            await load();
            toast({ title: "Device removed" });
        } catch (err: any) {
            toast({
                variant: "destructive",
                title: "Couldn't remove device",
                description: err?.message || "Please try again.",
            });
        } finally {
            setRemovingToken(null);
        }
    };

    // Nothing until the first load settles — an empty shell that pops into a
    // list reads worse than the section appearing complete.
    if (devices === null && !loadError) return null;

    const currentToken = getDeviceToken();
    const thisDeviceRegistered = !!currentToken && (devices ?? []).some((d) => d.device_token === currentToken);

    return (
        <section className="glass-panel rounded-3xl p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                    <Smartphone className="w-5 h-5" />
                </div>
                <div>
                    <h2 className="text-lg font-semibold tracking-tight">Your devices</h2>
                    <p className="text-muted-foreground text-sm">
                        You can use Techcess on 2 devices. Remove one to swap it for another.
                    </p>
                </div>
            </div>

            {loadError ? (
                <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                    <p className="text-sm text-muted-foreground">Couldn't load your devices just now.</p>
                    <Button size="sm" variant="outline" onClick={load} className="sm:w-auto">
                        Try again
                    </Button>
                </div>
            ) : (devices ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No devices registered yet.</p>
            ) : (
                <>
                    <DeviceList devices={devices!} onRemove={handleRemove} removingToken={removingToken} />
                    {/* Only shown when it's actually true: the student is reading
                        this on a browser that isn't one of the two. */}
                    {!thisDeviceRegistered && (
                        <p className="text-sm text-amber-700 dark:text-amber-400">
                            The device you're using now isn't one of them. Remove one above to use this one instead.
                        </p>
                    )}
                </>
            )}
        </section>
    );
}
