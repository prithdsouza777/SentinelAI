import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import OperationsCenter from "./pages/OperationsCenter";
import AgentsPage from "./pages/AgentsPage";
import AlertsPage from "./pages/AlertsPage";
import ChatPage from "./pages/ChatPage";
import SimulationPage from "./pages/SimulationPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import LoginPage from "./pages/LoginPage";
import LandingPage from "./pages/LandingPage";
import RequireAuth from "./components/auth/RequireAuth";

import "./pages/LandingPage.css";

function App() {
  return (
    <Routes>
      <Route index element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />

      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="dashboard" element={<OperationsCenter />} />
          <Route path="agents" element={<AgentsPage />} />
          <Route path="alerts" element={<AlertsPage />} />
          <Route path="chat" element={<ChatPage />} />
          <Route path="simulation" element={<SimulationPage />} />
          <Route path="reports" element={<ReportsPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Route>
    </Routes>
  );
}

export default App;
