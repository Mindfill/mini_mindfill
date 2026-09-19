import { Suspense, lazy } from "react";
import { Switch, Route, useLocation } from "wouter";
import TechcessLoader from "@/components/brand/TechcessLoader";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
// Home is the landing page every first-time visitor hits, so it's the one
// route kept in the main bundle — everything else is behind a login/nav
// action and is lazy-loaded, so the marketing page's LCP isn't paying for
// the weight of dashboards, chat, quizzes, and the admin UI it never uses.
import Home from "@/pages/home";

const Waitlist = lazy(() => import("@/pages/waitlist"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Login = lazy(() => import("@/pages/login"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const ParentDashboard = lazy(() => import("@/pages/dashboard-parent"));
const SchoolDashboard = lazy(() => import("@/pages/dashboard-school"));
const Admin = lazy(() => import("@/pages/admin"));
const Courses = lazy(() => import("@/pages/courses"));
const LessonChat = lazy(() => import("@/pages/lesson-chat"));
const Notes = lazy(() => import("@/pages/notes"));
const CourseNotes = lazy(() => import("@/pages/course-notes"));
// Uni notes: board of sections → one lesson per section (NOTES_LESSON_UI_SPEC).
// pages/note-chat.tsx (the old whole-note chat) is no longer routed.
const NoteBoard = lazy(() => import("@/pages/note-board"));
const NoteLesson = lazy(() => import("@/pages/note-lesson"));
const NoteReader = lazy(() => import("@/pages/note-reader"));
const Profile = lazy(() => import("@/pages/profile"));
const Upgrade = lazy(() => import("@/pages/upgrade"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Terms = lazy(() => import("@/pages/terms"));
const ResetPassword = lazy(() => import("@/pages/reset-password"));
const Onboarding = lazy(() => import("@/pages/onboarding"));
const InviteAccept = lazy(() => import("@/pages/invite-accept"));
// Every /secondary/* page renders inside one persistent layout (sidebar,
// background, guards), which owns its own nested routes.
const SecondaryLayout = lazy(() => import("@/components/secondary/SecondaryLayout"));

function RouteFallback() {
  return <TechcessLoader fullScreen />;
}

function Router() {
  const [location] = useLocation();
  return (
    <ErrorBoundary fullScreen resetKey={location.startsWith("/secondary/") ? "/secondary" : location}>
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/login" component={Login} />
        <Route path="/reset-password" component={ResetPassword} />
        <Route path="/onboarding" component={Onboarding} />
        <Route path="/invite/accept" component={InviteAccept} />
        <Route path="/dashboard" component={Dashboard} />
        <Route path="/secondary/*" component={SecondaryLayout} />
        <Route path="/parent/dashboard" component={ParentDashboard} />
        <Route path="/school/dashboard" component={SchoolDashboard} />
        <Route path="/admin" component={Admin} />
        <Route path="/courses" component={Courses} />
        <Route path="/lessons/:lessonSlug" component={LessonChat} />
        <Route path="/notes" component={Notes} />
        <Route path="/notes/course/:courseId" component={CourseNotes} />
        <Route path="/notes/:noteId/read" component={NoteReader} />
        <Route path="/notes/:noteId/sections/:sectionIndex" component={NoteLesson} />
        <Route path="/notes/:noteId" component={NoteBoard} />
        <Route path="/profile" component={Profile} />
        <Route path="/upgrade" component={Upgrade} />
        <Route path="/privacy" component={Privacy} />
        <Route path="/terms" component={Terms} />
        <Route path="/waitlist" component={Waitlist} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
    </ErrorBoundary>
  );
}

import { AuthProvider } from "@/hooks/use-auth";
import { CreditsProvider } from "@/hooks/use-credits";
import { SubscriptionProvider } from "@/hooks/use-subscription";
import { UserProfileProvider } from "@/hooks/use-user-profile";
import PaywallDialog from "@/components/billing/PaywallDialog";
import DeviceLimitDialog from "@/components/billing/DeviceLimitDialog";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <UserProfileProvider>
          <SubscriptionProvider>
          <CreditsProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
            <PaywallDialog />
            <DeviceLimitDialog />
          </TooltipProvider>
          </CreditsProvider>
          </SubscriptionProvider>
          </UserProfileProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

