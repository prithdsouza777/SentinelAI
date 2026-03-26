import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import LoginPage from "./pages/LoginPage";
import AuthCallbackPage from "./pages/AuthCallbackPage";
import LandingPage from "./pages/LandingPage";
import RequireAuth from "./components/auth/RequireAuth";

import "./pages/LandingPage.css";

// Lazy-load heavy pages to reduce initial bundle size
const OperationsCenter = lazy(() => import("./pages/OperationsCenter"));
const AgentsPage = lazy(() => import("./pages/AgentsPage"));
const AlertsPage = lazy(() => import("./pages/AlertsPage"));
const ChatPage = lazy(() => import("./pages/ChatPage"));
const SimulationPage = lazy(() => import("./pages/SimulationPage"));
const ReportsPage = lazy(() => import("./pages/ReportsPage"));
const WorkforcePage = lazy(() => import("./pages/WorkforcePage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));

function LazyPage({ children }: { children: React.ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<LazyPage><OperationsCenter /></LazyPage>} />
          <Route path="agents" element={<LazyPage><AgentsPage /></LazyPage>} />
          <Route path="alerts" element={<LazyPage><AlertsPage /></LazyPage>} />
          <Route path="chat" element={<LazyPage><ChatPage /></LazyPage>} />
          <Route path="simulation" element={<LazyPage><SimulationPage /></LazyPage>} />
          <Route path="reports" element={<LazyPage><ReportsPage /></LazyPage>} />
          <Route path="workforce" element={<LazyPage><WorkforcePage /></LazyPage>} />
          <Route path="settings" element={<LazyPage><SettingsPage /></LazyPage>} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
