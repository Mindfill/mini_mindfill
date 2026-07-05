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
import Profile from "@/pages/profile";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/courses" component={Courses} />
      <Route path="/lessons/:lessonSlug" component={LessonChat} />
      <Route path="/notes" component={Notes} />
      <Route path="/notes/course/:courseId" component={CourseNotes} />
      <Route path="/notes/:noteId" component={NoteChat} />
      <Route path="/profile" component={Profile} />
      <Route path="/waitlist" component={Waitlist} />
      <Route component={NotFound} />
    </Switch>
  );
}

import { AuthProvider } from "@/hooks/use-auth";

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <AuthProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;

