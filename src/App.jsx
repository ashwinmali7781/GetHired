import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";

// Code-split every route — the shared chunks (UI, Clerk, Supabase) are still
// bundled together; only page-level JS is deferred.
const HomePage            = lazy(() => import("./pages/HomePage"));
const LoginPage           = lazy(() => import("./pages/LoginPage"));
const SignupPage          = lazy(() => import("./pages/SignupPage"));
const SsoCallbackPage     = lazy(() => import("./pages/SsoCallbackPage"));
const DashboardPage       = lazy(() => import("./pages/DashboardPage"));
const PracticePage        = lazy(() => import("./pages/PracticePage"));
const ResumeAnalyzerPage  = lazy(() => import("./pages/ResumeAnalyzerPage"));
const InterviewPage       = lazy(() => import("./pages/InterviewPage"));
const VoiceInterviewPage  = lazy(() => import("./pages/VoiceInterviewPage"));
const ContestPage         = lazy(() => import("./pages/ContestPage"));
const LeaderboardPage     = lazy(() => import("./pages/LeaderboardPage"));
const ProfilePage         = lazy(() => import("./pages/ProfilePage"));
const NotFound            = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Don't refetch on window focus in this app — the data (practice history,
      // leaderboard) changes infrequently and refetching on every tab switch is
      // noisy.
      refetchOnWindowFocus: false,
      // Retry once before surfacing an error to the user.
      retry: 1,
      // Keep data fresh for 2 minutes.
      staleTime: 2 * 60 * 1000,
    },
  },
});

/** Full-screen spinner shown while a lazy-loaded chunk is downloading. */
const PageFallback = () => (
  <div className="flex min-h-screen items-center justify-center bg-background">
    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" aria-label="Loading page…" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Suspense fallback={<PageFallback />}>
            <Routes>
              {/* Public */}
              <Route path="/"            element={<HomePage />} />
              <Route path="/login"       element={<LoginPage />} />
              <Route path="/signup"      element={<SignupPage />} />
              <Route path="/sso-callback" element={<SsoCallbackPage />} />

              {/* Protected — all children share AppLayout (navbar + sync) */}
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard"       element={<DashboardPage />} />
                <Route path="/practice"        element={<PracticePage />} />
                <Route path="/resume-analyzer" element={<ResumeAnalyzerPage />} />
                <Route path="/interview"       element={<InterviewPage />} />
                <Route path="/voice-interview" element={<VoiceInterviewPage />} />
                <Route path="contest" element={<ContestPage />} />
                <Route path="/leaderboard"     element={<LeaderboardPage />} />
                <Route path="/profile"         element={<ProfilePage />} />
              </Route>

              {/* 404 */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
