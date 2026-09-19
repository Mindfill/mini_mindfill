import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/api";
import { useUserProfile } from "@/hooks/use-user-profile";
import { ScreenProps } from "../utils";

export default function UniversityDashboardLanding({ accessToken, collected }: ScreenProps) {
    const [, navigate] = useLocation();
    const { refresh: refreshProfile } = useUserProfile();
    const [submitting, setSubmitting] = useState(false);

    const handleContinue = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await completeOnboarding(accessToken);
            await refreshProfile();
            navigate("/dashboard");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setSubmitting(false);
        }
    };

    return (
        <div className="space-y-8">
            <h1 className="font-display text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                {collected.fullName ? `${collected.fullName}, you're ready.` : "You're ready."}
            </h1>
            <p className="text-muted-foreground">
                You start with 10 free credits. We'll let you know when it's time to upgrade.
            </p>
            <Button size="lg" onClick={handleContinue} disabled={submitting} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Go to dashboard
            </Button>
        </div>
    );
}
