/** Deliberate pause after every onboarding click before advancing — gives the
 * step a settled, intentional feel instead of an instant jump-cut. The save
 * itself fires immediately in the background; this delay is purely visual. */
export const ADVANCE_DELAY_MS = 500;

export function calculateAge(dob: string): number {
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export function ageResponse(age: number, userType: "secondary" | "university"): string {
    if (userType === "secondary") {
        if (age < 16) return "You're starting earlier than most people ever do. That's rare.";
        if (age < 18) return "Right in the thick of it. This is exactly the right time.";
        return "You came back to get it right. Respect.";
    }
    if (age < 21) return "Right at the beginning. Everything is still possible.";
    if (age < 24) return "Deep in it now. This is where it gets real.";
    if (age < 28) return "You're doing this alongside everything else. Respect.";
    return "You came back for it. That takes something most people don't have.";
}

export const SENTIMENT_OPTIONS = [
    { value: "yes", label: "Yes, school prepares you for life", response: "We agree — when it's done right." },
    { value: "depends", label: "It depends on what you do with it", response: "That's the most honest answer." },
    {
        value: "waste",
        label: "Honestly? It's mostly a waste of time",
        response: "We built this because we think you're right about most of it.",
    },
    { value: "dont_know", label: "I don't know yet", response: "That's exactly why you're here." },
];

export const SECONDARY_GOAL_OPTIONS = [
    "Engineer something that changes Nigeria",
    "Become a doctor",
    "Understand how the world actually works",
    "Get into a great university",
    "Make my family proud",
    "Build something of my own",
];

export const STRUGGLE_TOPIC_OPTIONS = [
    "Calculus",
    "Linear Algebra",
    "Physics",
    "Statistics",
    "Programming",
    "Thermodynamics",
    "Something else",
];

export interface OnboardingAnswers {
    fullName?: string;
    dateOfBirth?: string;
    secondaryClassLevel?: "SS1" | "SS2" | "SS3";
    schoolName?: string;
    lifeGoals?: string[];
    institutionName?: string;
    courseOfStudy?: string;
    struggleTopics?: string[];
    educationSentiment?: string;
    hasDyslexia?: boolean;
    notificationWhatsapp?: boolean;
    notificationEmail?: boolean;
    phoneNumber?: string;
}

export interface ScreenProps {
    accessToken: string;
    screenNumber: number;
    collected: OnboardingAnswers;
    onNext: (patch?: Partial<OnboardingAnswers>) => void;
    onBack: () => void;
}
