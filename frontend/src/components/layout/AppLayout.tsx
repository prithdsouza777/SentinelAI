import { useEffect, useRef } from "react";
import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useWebSocketConnection } from "../../hooks/useWebSocket";
import WebSocketProvider from "../WebSocketProvider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useDashboardStore } from "../../stores/dashboardStore";

export default function AppLayout() {
  useWebSocketConnection();
  const resetForNewDemo = useDashboardStore((s) => s.resetForNewDemo);
  const didReset = useRef(false);

  // On browser refresh: clear backend metrics (not simulation) + frontend store
  useEffect(() => {
    if (didReset.current) return;
    didReset.current = true;
    
    // Slight delay to give backend time to start
    const timer = setTimeout(() => {
      fetch("/api/session/reset", { method: "POST" })
        .then(() => resetForNewDemo())
        .catch(() => {});
    }, 1500);

    return () => clearTimeout(timer);
  }, [resetForNewDemo]);

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9]">
        <WebSocketProvider />
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-4 bg-grid">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
