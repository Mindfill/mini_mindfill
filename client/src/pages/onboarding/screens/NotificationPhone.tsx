import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { saveSecondaryOnboarding, saveUniversityOnboarding } from "@/lib/api";
import { ADVANCE_DELAY_MS, ScreenProps } from "../utils";

interface NotificationPhoneProps extends ScreenProps {
    userType: "secondary" | "university";
}

export default function NotificationPhone({
    accessToken,
    screenNumber,
    onNext,
    onBack,
    userType,
}: NotificationPhoneProps) {
    const [whatsapp, setWhatsapp] = useState(false);
    const [emailPref, setEmailPref] = useState(true);
    const [phone, setPhone] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const handleSubmit = () => {
        if (submitting) return;
        setSubmitting(true);
        const payload: any = {
            screen: screenNumber,
            notification_prefs: { whatsapp, email: emailPref },
        };
        if (phone.trim()) payload.phone_number = phone.trim();

        const save =
            userType === "secondary"
                ? saveSecondaryOnboarding(payload, accessToken)
                : saveUniversityOnboarding(payload, accessToken);
        save.catch((err) => console.error("Failed to save notification prefs:", err));
        setTimeout(
            () => onNext({ notificationWhatsapp: whatsapp, notificationEmail: emailPref, phoneNumber: phone.trim() }),
            ADVANCE_DELAY_MS
        );
    };

    return (
        <div className="space-y-6">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                How should we reach you?
            </h1>

            <div className="space-y-4 text-left bg-card border border-border rounded-2xl p-5">
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">Email reminders</p>
                        <p className="text-xs text-muted-foreground">Progress and streak nudges</p>
                    </div>
                    <Switch checked={emailPref} onCheckedChange={setEmailPref} disabled={submitting} />
                </div>
                <div className="flex items-center justify-between gap-4">
                    <div>
                        <p className="text-sm font-medium">WhatsApp reminders</p>
                        <p className="text-xs text-muted-foreground">Requires a phone number below</p>
                    </div>
                    <Switch checked={whatsapp} onCheckedChange={setWhatsapp} disabled={submitting} />
                </div>
            </div>

            <div className="space-y-1.5 text-left">
                <Label htmlFor="phone">Phone number (optional)</Label>
                <Input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+234..."
                    className="h-12"
                    disabled={submitting}
                />
            </div>

            <Button size="lg" disabled={submitting} onClick={handleSubmit} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
            </Button>

            <button onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground">
                Back
            </button>
        </div>
    );
}
