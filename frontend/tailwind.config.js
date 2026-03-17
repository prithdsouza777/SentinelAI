/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: "var(--destructive)",
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        brand: {
          50: "#eef5ff",
          100: "#d9e8ff",
          200: "#bbd8ff",
          300: "#8cc0ff",
          400: "#559eff",
          500: "#2e79fc",
          600: "#1859f1",
          700: "#1144de",
          800: "#1438b4",
          900: "#17338e",
          950: "#122156",
        },
        surface: {
          DEFAULT: "#0a0c14",
          raised: "#111320",
          overlay: "#181b2e",
        },
        "accent-success": "#22c55e",
        "accent-warning": "#f59e0b",
        "accent-danger": "#ef4444",
        "accent-info": "#3b82f6",
      },
      fontFamily: {
        sans: ["Geist Variable", "Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.3s ease-out",
        "slide-in-right": "slideInRight 0.35s ease-out",
        "fade-in": "fadeIn 0.2s ease-out",
        "fade-in-up": "fadeInUp 0.3s ease-out",
        "glow-pulse": "glowPulse 2s ease-in-out infinite",
        "border-flash": "borderFlash 0.6s ease-out",
        "number-pop": "numberPop 0.4s ease-out",
        "conflict-pulse": "conflictPulse 2s ease-in-out infinite",
        "critical-flash": "criticalFlash 1.5s ease-in-out infinite",
        "shimmer": "shimmer 2s linear infinite",
        "spotlight": "spotlight 2s ease-in-out infinite",
        "meteor": "meteor 5s linear infinite",
      },
      keyframes: {
        slideIn: {
          "0%": { transform: "translateX(100%)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        slideInRight: {
          "0%": { transform: "translateX(20px)", opacity: "0" },
          "100%": { transform: "translateX(0)", opacity: "1" },
        },
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeInUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(34, 197, 94, 0)" },
          "50%": { boxShadow: "0 0 20px 4px rgba(34, 197, 94, 0.2)" },
        },
        borderFlash: {
          "0%": { borderColor: "rgba(239, 68, 68, 0.8)" },
          "100%": { borderColor: "rgba(239, 68, 68, 0.2)" },
        },
        numberPop: {
          "0%": { transform: "scale(1)" },
          "50%": { transform: "scale(1.15)" },
          "100%": { transform: "scale(1)" },
        },
        conflictPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(249, 115, 22, 0)", borderColor: "rgba(249, 115, 22, 0.3)" },
          "50%": { boxShadow: "0 0 16px 4px rgba(249, 115, 22, 0.2)", borderColor: "rgba(249, 115, 22, 0.6)" },
        },
        criticalFlash: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(239, 68, 68, 0)" },
          "50%": { boxShadow: "0 0 16px 4px rgba(239, 68, 68, 0.25)" },
        },
        shimmer: {
          "from": { backgroundPosition: "0 0" },
          "to": { backgroundPosition: "-200% 0" },
        },
        spotlight: {
          "0%": { opacity: "0", transform: "translate(-72%, -62%) scale(0.5)" },
          "100%": { opacity: "1", transform: "translate(-50%, -40%) scale(1)" },
        },
        meteor: {
          "0%": { transform: "rotate(215deg) translateX(0)", opacity: "1" },
          "70%": { opacity: "1" },
          "100%": { transform: "rotate(215deg) translateX(-500px)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};
