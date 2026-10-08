import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Laptop } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { deregisterDevice } from "@/lib/api";
import DeviceList from "@/components/billing/DeviceList";

/**
 * App-wide notice shown when POST /devices/register comes back 403 (already
 * at the 2-device cap for this account). Dismissable, because hitting the cap
 * doesn't break the uni side — but the secondary lesson endpoints do enforce
 * it (`verify_device`), so a dismissed dialog is not the end of the story.
 *
 * This only ever appears on the SIGNED_IN event, so it can't be relied on as
 * the way out: a reload never re-triggers it. The durable place to manage
 * devices is DevicesSection on the profile page, and the blocked-lesson screen
 * (AccessErrorState) handles the same thing in place.
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

                <div className="pt-2">
                    <DeviceList
                        devices={deviceLimit ?? []}
                        onRemove={handleRemove}
                        removingToken={removingToken}
                    />
                </div>
            </DialogContent>
        </Dialog>
    );
}
