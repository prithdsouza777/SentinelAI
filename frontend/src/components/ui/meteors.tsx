import { cn } from "@/lib/utils";

export function Meteors({ number = 12, className }: { number?: number; className?: string }) {
  const meteors = new Array(number).fill(null);
  return (
    <>
      {meteors.map((_, idx) => (
        <span
          key={idx}
          className={cn(
            "absolute left-1/2 top-1/2 h-0.5 w-0.5 rotate-[215deg] rounded-full bg-slate-400 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-px before:w-[50px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-blue-500/60 before:to-transparent before:content-['']",
            "animate-meteor",
            className
          )}
          style={{
            top: `${Math.random() * 100}%`,
            left: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${Math.floor(Math.random() * 8 + 4)}s`,
          }}
        />
      ))}
    </>
  );
}
