import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useUserProfile } from "@/hooks/use-user-profile";
import { UserType } from "@/lib/api";
import OnboardingShell from "./OnboardingShell";
import { OnboardingAnswers } from "./utils";

import WhoAreYou from "./screens/WhoAreYou";
import Name from "./screens/Name";
import Dob from "./screens/Dob";
import ClassLevel from "./screens/ClassLevel";
import School from "./screens/School";
import Goals from "./screens/Goals";
import InstitutionCourse from "./screens/InstitutionCourse";
import StruggleTopics from "./screens/StruggleTopics";
import Sentiment from "./screens/Sentiment";
import NotificationPhone from "./screens/NotificationPhone";
import Terms from "./screens/Terms";
import Paywall from "./screens/Paywall";
import ParentDashboardLanding from "./screens/ParentDashboardLanding";
import UniversityDashboardLanding from "./screens/UniversityDashboardLanding";

// Index 0 ("who_are_you") is universal and always screen 1 on the backend —
// every array below deliberately shares that first slot so switching types
// via the back button always lands back on index 1 ("name").
const SECONDARY_FLOW = [
    "who_are_you", "name", "dob", "class_level", "school",
    "goals", "sentiment", "notification_phone", "terms", "paywall",
];
const UNIVERSITY_FLOW = [
    "who_are_you", "name", "dob", "institution_course", "struggle_topics",
    "sentiment", "notification_phone", "terms", "dashboard",
];
const PARENT_FLOW = ["who_are_you", "name", "terms", "dashboard"];

export default function Onboarding() {
    const { session, isLoading: authLoading } = useAuth();
    const [, navigate] = useLocation();
    const accessToken = session?.access_token || "";

    const {
        userType: contextUserType,
        onboardingStep,
        onboardingCompleted,
        loading: profileLoading,
        refresh,
    } = useUserProfile();

    const [localUserType, setLocalUserType] = useState<UserType | null>(null);
    const [step, setStep] = useState<number | null>(null);
    const [collected, setCollected] = useState<OnboardingAnswers>({});

    useEffect(() => {
        if (!authLoading && !session) navigate("/login");
    }, [authLoading, session, navigate]);

    useEffect(() => {
        document.title = "Welcome | TECHCESS";
    }, []);

    // This page's only job is to get onboarding_completed to true — once it
    // is, leave immediately (covers a completed user navigating here directly).
    useEffect(() => {
        if (!profileLoading && onboardingCompleted) {
            navigate("/dashboard");
        }
    }, [profileLoading, onboardingCompleted, navigate]);

    // Initialize step/type from server state exactly once, on load. Backend
    // screen numbers are 1-based and index 0 is always screen 1, so the
    // array index to resume at equals onboarding_step itself (no offset).
    useEffect(() => {
        if (profileLoading || step !== null || onboardingCompleted) return;
        if (onboardingStep === 0) {
            setStep(0);
        } else {
            setLocalUserType(contextUserType);
            setStep(onboardingStep);
        }
    }, [profileLoading, onboardingStep, contextUserType, onboardingCompleted, step]);

    if (authLoading || !session || profileLoading || step === null || onboardingCompleted) {
        return (
            <div className="min-h-[100dvh] w-full flex items-center justify-center bg-background">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const flow =
        localUserType === "secondary"
            ? SECONDARY_FLOW
            : localUserType === "university"
            ? UNIVERSITY_FLOW
            : localUserType === "parent"
            ? PARENT_FLOW
            : ["who_are_you"];

    const clampedStep = Math.min(step, flow.length - 1);
    const screenName = flow[clampedStep];

    const goNext = (patch?: Partial<OnboardingAnswers>) => {
        if (patch) setCollected((prev) => ({ ...prev, ...patch }));
        setStep((s) => (s ?? 0) + 1);
        refresh();
    };

    const goBack = () => {
        setStep((s) => Math.max(0, (s ?? 0) - 1));
    };

    const handleSelectType = (type: UserType) => {
        setLocalUserType(type);
        setCollected({}); // switching types invalidates locally-collected type-specific answers
        setStep(1);
        refresh();
    };

    const screenNumber = clampedStep + 1;
    const commonProps = { accessToken, screenNumber, collected, onNext: goNext, onBack: goBack };

    let content: JSX.Element;
    switch (screenName) {
        case "who_are_you":
            content = <WhoAreYou accessToken={accessToken} currentType={localUserType} onSelect={handleSelectType} />;
            break;
        case "name":
            content = <Name {...commonProps} userType={localUserType as UserType} />;
            break;
        case "dob":
            content = <Dob {...commonProps} userType={localUserType as "secondary" | "university"} />;
            break;
        case "class_level":
            content = <ClassLevel {...commonProps} />;
            break;
        case "school":
            content = <School {...commonProps} />;
            break;
        case "goals":
            content = <Goals {...commonProps} />;
            break;
        case "institution_course":
            content = <InstitutionCourse {...commonProps} />;
            break;
        case "struggle_topics":
            content = <StruggleTopics {...commonProps} />;
            break;
        case "sentiment":
            content = <Sentiment {...commonProps} userType={localUserType as "secondary" | "university"} />;
            break;
        case "notification_phone":
            content = <NotificationPhone {...commonProps} userType={localUserType as "secondary" | "university"} />;
            break;
        case "terms":
            content = <Terms {...commonProps} />;
            break;
        case "paywall":
            content = <Paywall {...commonProps} />;
            break;
        case "dashboard":
            content =
                localUserType === "parent" ? (
                    <ParentDashboardLanding {...commonProps} />
                ) : (
                    <UniversityDashboardLanding {...commonProps} />
                );
            break;
        default:
            content = <div />;
    }

    return (
        <OnboardingShell
            step={clampedStep}
            totalSteps={flow.length - 1}
            onBack={clampedStep > 0 ? goBack : undefined}
            transitionKey={`${localUserType}-${clampedStep}`}
        >
            {content}
        </OnboardingShell>
    );
}
