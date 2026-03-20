import { Outlet } from "react-router-dom";
import Header from "./Header";
import Sidebar from "./Sidebar";
import { useWebSocketConnection } from "../../hooks/useWebSocket";
import WebSocketProvider from "../WebSocketProvider";
import { TooltipProvider } from "@/components/ui/tooltip";

export default function AppLayout() {
  useWebSocketConnection();

  return (
    <TooltipProvider>
      <div className="flex h-screen overflow-hidden bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9]">
        <WebSocketProvider />
        <Sidebar />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Header />
          <main className="flex-1 overflow-auto p-4">
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
}
