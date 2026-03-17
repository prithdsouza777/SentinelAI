import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BrainCircuit,
  AlertTriangle,
  MessageSquare,
  FlaskConical,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";


const navItems = [
  { icon: LayoutDashboard, label: "Operations", href: "/" },
  { icon: BrainCircuit, label: "Agents", href: "/agents" },
  { icon: AlertTriangle, label: "Alerts", href: "/alerts" },
  { icon: MessageSquare, label: "Chat", href: "/chat" },
  { icon: FlaskConical, label: "Simulation", href: "/simulation" },
  { icon: Settings, label: "Settings", href: "/settings" },
];

export default function Sidebar() {
  return (
    <aside className="flex w-16 flex-col items-center border-r border-white/[0.06] bg-surface py-4">
      <NavLink
        to="/"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 text-xs font-bold text-white shadow-lg shadow-blue-500/20 transition-transform hover:scale-105"
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
                  ? "bg-white/10 text-white shadow-sm shadow-blue-500/10"
                  : "text-muted-foreground hover:bg-white/5 hover:text-white"
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
