import { Routes, Route } from "react-router-dom";
import AppLayout from "./components/layout/AppLayout";
import OperationsCenter from "./pages/OperationsCenter";
import AgentsPage from "./pages/AgentsPage";
import AlertsPage from "./pages/AlertsPage";
import ChatPage from "./pages/ChatPage";
import SimulationPage from "./pages/SimulationPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<OperationsCenter />} />
        <Route path="agents" element={<AgentsPage />} />
        <Route path="alerts" element={<AlertsPage />} />
        <Route path="chat" element={<ChatPage />} />
        <Route path="simulation" element={<SimulationPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}

export default App;
