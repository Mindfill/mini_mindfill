import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Laptop, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deregisterDevice } from "@/lib/api";

/**
 * App-wide notice shown when POST /devices/register comes back 403 (already
 * at the 2-device cap for this account). Dismissable — hitting the cap has
 * no effect on any existing (uni-side) feature yet; it only matters once
 * Feature 02's paid secondary content starts checking device registration.
 */
export default function DeviceLimitDialog() {
    const { deviceLimit, retryDeviceRegistration, session } = useAuth();
    const [removingToken, setRemovingToken] = useState<string | null>(null);
    const [dismissed, setDismissed] = useState(false);

    const open = !!deviceLimit && deviceLimit.length > 0 && !dismissed;

    const handleRemove = async (deviceToken: string) => {
        if (!session?.access_token) return;
        setRemovingToken(deviceToken);
        try {
            await deregisterDevice(deviceToken, session.access_token);
            await retryDeviceRegistration();
        } catch (err) {
            console.error("[device] Failed to remove device:", err);
        } finally {
            setRemovingToken(null);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(next) => !next && setDismissed(true)}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary mb-2">
                        <Laptop className="w-6 h-6" />
                    </div>
                    <DialogTitle className="text-xl">Device limit reached</DialogTitle>
                    <DialogDescription>
                        Your account is signed in on the maximum of 2 devices. Remove one below to use this device instead.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-2 pt-2">
                    {(deviceLimit ?? []).map((device) => (
                        <div
                            key={device.device_token}
                            className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5"
                        >
                            <div className="min-w-0">
                                <p className="text-sm font-medium truncate">{device.device_name || "Unknown device"}</p>
                                <p className="text-xs text-muted-foreground">
                                    Last active {new Date(device.last_seen_at).toLocaleDateString()}
                                </p>
                            </div>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={removingToken === device.device_token}
                                onClick={() => handleRemove(device.device_token)}
                            >
                                {removingToken === device.device_token && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                )}
                                Remove
                            </Button>
                        </div>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    );
}
