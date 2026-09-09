import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { completeOnboarding } from "@/lib/api";
import { ScreenProps } from "../utils";

export default function ParentDashboardLanding({ accessToken }: ScreenProps) {
    const [, navigate] = useLocation();
    const [submitting, setSubmitting] = useState(false);

    const handleContinue = async () => {
        if (submitting) return;
        setSubmitting(true);
        try {
            await completeOnboarding(accessToken);
            navigate("/dashboard");
        } catch (err) {
            console.error("Failed to complete onboarding:", err);
            setSubmitting(false);
        }
    };

    return (
        <div className="text-center space-y-8">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight leading-tight">
                You're set up.
            </h1>
            <p className="text-muted-foreground">
                Once your child links you, you'll see their progress here.
            </p>
            <Button size="lg" onClick={handleContinue} disabled={submitting} className="w-full gap-2">
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Go to dashboard
            </Button>
        </div>
    );
}
