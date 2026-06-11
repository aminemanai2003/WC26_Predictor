import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // WC 2026 inspired palette
        ink: { 950: "#06080f", 900: "#0b0f1a", 800: "#121826", 700: "#1c2436", 600: "#2a334a" },
        accent: {
          green: "#10e07d", // pitch green
          red: "#ff3b5c",   // alert red
          blue: "#4d8dff",  // sky
          gold: "#ffc857",  // trophy gold
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "Helvetica", "Arial"],
        display: ["Inter", "ui-sans-serif", "system-ui"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      boxShadow: {
        glow: "0 0 40px -10px rgba(16, 224, 125, 0.45)",
        card: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 30px 60px -30px rgba(0,0,0,0.6)",
      },
      backgroundImage: {
        "grid-fade":
          "radial-gradient(ellipse at top, rgba(77,141,255,0.12), transparent 60%), radial-gradient(ellipse at bottom right, rgba(16,224,125,0.10), transparent 50%)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out both",
        "slide-up": "slideUp 0.5s ease-out both",
        shimmer: "shimmer 2.4s linear infinite",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0" }, to: { opacity: "1" } },
        slideUp: { from: { transform: "translateY(12px)", opacity: "0" }, to: { transform: "translateY(0)", opacity: "1" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
    },
  },
  plugins: [],
};
export default config;
