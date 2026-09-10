import { Switch, Route } from "wouter";
import { ThemeProvider } from "next-themes";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Home from "@/pages/home";
import Waitlist from "@/pages/waitlist";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Courses from "@/pages/courses";
import LessonChat from "@/pages/lesson-chat";
import Notes from "@/pages/notes";
import CourseNotes from "@/pages/course-notes";
import NoteChat from "@/pages/note-chat";
import NoteReader from "@/pages/note-reader";
import Profile from "@/pages/profile";
import Upgrade from "@/pages/upgrade";
import Privacy from "@/pages/privacy";
import Terms from "@/pages/terms";
import ResetPassword from "@/pages/reset-password";
import Onboarding from "@/pages/onboarding";
import InviteAccept from "@/pages/invite-accept";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/onboarding" component={Onboarding} />
      <Route path="/invite/accept" component={InviteAccept} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/courses" component={Courses} />
      <Route path="/lessons/:lessonSlug" component={LessonChat} />
      <Route path="/notes" component={Notes} />
      <Route path="/notes/course/:courseId" component={CourseNotes} />
      <Route path="/notes/:noteId/read" component={NoteReader} />
      <Route path="/notes/:noteId" component={NoteChat} />
      <Route path="/profile" component={Profile} />
      <Route path="/upgrade" component={Upgrade} />
      <Route path="/privacy" component={Privacy} />
      <Route path="/terms" component={Terms} />
      <Route path="/waitlist" component={Waitlist} />
      <Route component={NotFound} />
    </Switch>
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

