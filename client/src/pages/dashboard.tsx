import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUserProfile } from "@/hooks/use-user-profile";
import UniversityDashboard from "./dashboard-university";
import SecondaryDashboard from "./dashboard-secondary";
import ParentDashboard from "./dashboard-parent";
import SchoolDashboard from "./dashboard-school";

/**
 * /dashboard is the canonical post-login landing route every onboarding
 * screen (and login) navigates to — this router picks the right dashboard
 * by role first (school_admin / admin are RBAC roles, not onboarding
 * user_types), then falls back to user_type for regular accounts.
 */
export default function Dashboard() {
    const { userType, role, loading } = useUserProfile();
    const [, navigate] = useLocation();

    useEffect(() => {
        if (!loading && role === "admin") navigate("/admin");
    }, [loading, role, navigate]);

    if (loading || role === "admin") return null;

    if (role === "school_admin") return <SchoolDashboard />;
    if (userType === "secondary") return <SecondaryDashboard />;
    if (userType === "parent") return <ParentDashboard />;
    return <UniversityDashboard />;
}
