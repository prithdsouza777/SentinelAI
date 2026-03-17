import { cn } from "@/lib/utils";

export function GlowingBorder({
  children,
  className,
  glowColor = "from-blue-500 via-purple-500 to-cyan-500",
  active = true,
}: {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  active?: boolean;
}) {
  return (
    <div className={cn("relative rounded-xl p-px", className)}>
      {active && (
        <div
          className={cn(
            "absolute inset-0 rounded-xl bg-gradient-to-r opacity-20 blur-sm transition-opacity duration-500",
            glowColor
          )}
        />
      )}
      <div
        className={cn(
          "absolute inset-0 rounded-xl bg-gradient-to-r opacity-40",
          active ? glowColor : "from-white/5 to-white/5"
        )}
        style={{ maskImage: "linear-gradient(black, black) content-box, linear-gradient(black, black)", maskComposite: "exclude", padding: "1px", WebkitMaskComposite: "xor" }}
      />
      <div className="relative rounded-xl bg-card">
        {children}
      </div>
    </div>
  );
}
