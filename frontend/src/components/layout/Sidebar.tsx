import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  BrainCircuit,
  AlertTriangle,
  MessageSquare,
  FlaskConical,
  Settings,
} from "lucide-react";
import { clsx } from "clsx";

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
    <aside className="flex w-16 flex-col items-center border-r border-gray-800 bg-surface py-4">
      <NavLink
        to="/"
        className="mb-6 flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold"
      >
        IQ
      </NavLink>

      <nav className="flex flex-1 flex-col items-center gap-1">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.href}
            end={item.href === "/"}
            className={({ isActive }) =>
              clsx(
                "group flex h-10 w-10 items-center justify-center rounded-lg transition-colors",
                isActive
                  ? "bg-brand-600/15 text-brand-400"
                  : "text-gray-500 hover:bg-gray-800 hover:text-gray-300"
              )
            }
            title={item.label}
          >
            <item.icon className="h-5 w-5" />
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
