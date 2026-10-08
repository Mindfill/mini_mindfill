import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { getDeviceToken, type DeviceRow } from "@/lib/device";

/**
 * The registered-devices list with its Remove buttons, shared by all three
 * places a student can hit the 2-device cap: the app-wide dialog, the profile
 * page's Devices section, and the blocked-lesson screen. One component so the
 * three never drift apart in wording or behaviour.
 */
export default function DeviceList({
    devices,
    onRemove,
    removingToken,
}: {
    devices: DeviceRow[];
    onRemove: (deviceToken: string) => void;
    /** Token mid-removal — shows a spinner on that row only. */
    removingToken: string | null;
}) {
    // On a device that was refused registration this matches nothing, so the
    // badge simply doesn't appear — which is correct: it isn't one of them.
    const currentToken = getDeviceToken();

    return (
        <div className="space-y-2">
            {devices.map((device) => {
                const isCurrent = !!currentToken && device.device_token === currentToken;
                return (
                    <div
                        key={device.device_token}
                        className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2.5"
                    >
                        <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{device.device_name || "Unknown device"}</p>
                            <p className="text-xs text-muted-foreground">
                                Last active {new Date(device.last_seen_at).toLocaleDateString()}
                            </p>
                        </div>
                        {isCurrent ? (
                            // No Remove on the device you're holding. Freeing its
                            // slot would only let it re-register straight away, so
                            // the button would read as doing nothing.
                            <span className="text-xs text-muted-foreground uppercase tracking-wide shrink-0">
                                This device
                            </span>
                        ) : (
                            <Button
                                size="sm"
                                variant="outline"
                                className="shrink-0"
                                disabled={removingToken === device.device_token}
                                onClick={() => onRemove(device.device_token)}
                            >
                                {removingToken === device.device_token && (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                                )}
                                Remove
                            </Button>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
