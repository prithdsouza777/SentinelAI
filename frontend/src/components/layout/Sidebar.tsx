import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BrainCircuit,
  AlertTriangle,
  MessageSquare,
  FlaskConical,
  FileBarChart,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";


const navItems = [
  { icon: LayoutDashboard, label: "Operations", href: "/" },
  { icon: BrainCircuit, label: "Agents", href: "/agents" },
  { icon: AlertTriangle, label: "Alerts", href: "/alerts" },
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: FlaskConical, label: "Simulation", href: "/simulation" },
  { icon: FileBarChart, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-16 flex-col items-center bg-[#172554] py-4">
      <NavLink
        to="/"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af] text-xs font-bold text-white shadow-lg transition-transform hover:scale-105"
        title="SentinelAI"
      >
        AI
      </NavLink>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              cn(
                "group flex h-10 w-10 items-center justify-center rounded-lg transition-all duration-200",
                isActive
                  ? "bg-[#1e3a8a] text-white shadow-sm"
                  : "text-[#bfdbfe] hover:bg-[#1e3a8a]/60 hover:text-white"
              )
            }
            title={item.label}
          >
            <item.icon className="h-[18px] w-[18px]" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
