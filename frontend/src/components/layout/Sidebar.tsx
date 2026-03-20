import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BrainCircuit,
  AlertTriangle,
  MessageSquare,
  FlaskConical,
  FileBarChart,
  Settings,
  Activity,
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { icon: LayoutDashboard, label: "Operations", href: "/dashboard" },
  { icon: BrainCircuit, label: "Agents", href: "/agents" },
  { icon: AlertTriangle, label: "Alerts", href: "/alerts" },
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: FlaskConical, label: "Simulation", href: "/simulation" },
  { icon: FileBarChart, label: "Reports", href: "/reports" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-[220px] flex-col bg-[#172554] border-r border-[#1e40af]">
      {/* Logo */}
      <NavLink
        to="/"
        className="flex items-center gap-3 px-5 py-5 border-b border-[#1e40af]"
      >
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1e40af] shadow-lg shadow-blue-900/40">
          <Activity className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="flex flex-col">
          <span className="text-[15px] font-bold tracking-tight text-white">
            Sentinel<span className="text-[#3b82f6]">AI</span>
          </span>
          <span className="text-[10px] font-medium text-[#bfdbfe]">
            Cirrus<span className="text-[#f87171]">Labs</span>
          </span>
        </div>
      </NavLink>

      {/* Section label */}
      <div className="px-5 pt-5 pb-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#9ca3af]">
          Navigation
        </p>
      </div>

      {/* Nav items */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            end={item.href === "/dashboard"}
            className={({ isActive }) =>
              cn(
                "group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-[#1e3a8a] text-white shadow-sm shadow-blue-900/30"
                  : "text-[#d1d5db] hover:bg-[#1e3a8a]/60 hover:text-white"
              )
            }
          >
            <item.icon className="h-[18px] w-[18px] shrink-0" />
            <span>{item.label}</span>
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-[#1e40af] px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1e40af] text-xs font-bold text-[#dbeafe]">
            AI
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-white">Operations</p>
            <p className="truncate text-[11px] text-[#bfdbfe]">AI Operator</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
