import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUserProfile } from "@/hooks/use-user-profile";
import TechcessLoader from "@/components/brand/TechcessLoader";
import UniversityDashboard from "./dashboard-university";
import ParentDashboard from "./dashboard-parent";
import SchoolDashboard from "./dashboard-school";

/**
 * /dashboard is the canonical post-login landing route every onboarding
 * screen (and login) navigates to — this router picks the right dashboard
 * by role first (school_admin / admin are RBAC roles, not onboarding
 * user_types), then falls back to user_type for regular accounts.
 *
 * Secondary students are sent to /secondary/dashboard, which lives inside
 * the persistent secondary layout — rendering it here would build a second,
 * separate copy of that frame and re-mount it on the student's first click.
 */
export default function Dashboard() {
    const { userType, role, loading } = useUserProfile();
    const [, navigate] = useLocation();

    const redirectTo = loading ? null : role === "admin" ? "/admin" : userType === "secondary" && role !== "school_admin" ? "/secondary/dashboard" : null;

    useEffect(() => {
        if (redirectTo) navigate(redirectTo, { replace: true });
    }, [redirectTo, navigate]);

    if (loading || redirectTo) return <TechcessLoader fullScreen delayMs={0} />;

    if (role === "school_admin") return <SchoolDashboard />;
    if (userType === "parent") return <ParentDashboard />;
    return <UniversityDashboard />;
}
