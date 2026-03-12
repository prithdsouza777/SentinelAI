/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
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
          DEFAULT: "#0f1117",
          raised: "#161822",
          overlay: "#1c1f2e",
        },
        accent: {
          success: "#22c55e",
          warning: "#f59e0b",
          danger: "#ef4444",
          info: "#3b82f6",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
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
          "50%": { boxShadow: "0 0 12px 2px rgba(34, 197, 94, 0.3)" },
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
      },
    },
  },
  plugins: [],
};
