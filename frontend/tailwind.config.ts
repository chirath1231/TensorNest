import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Mirrors the CSS custom properties in globals.css so the palette can
        // be reached from utility classes too (text-accent, border-accent/40).
        accent: "rgb(var(--accent) / <alpha-value>)",
        accent2: "rgb(var(--accent-2) / <alpha-value>)",
        accent3: "rgb(var(--accent-3) / <alpha-value>)",
      },
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        flash: {
          "0%": { backgroundColor: "rgba(34,211,238,0.14)" },
          "100%": { backgroundColor: "transparent" },
        },
        // Slow parallax drift for the aurora blobs behind the glass.
        drift: {
          "0%,100%": { transform: "translate3d(0,0,0) scale(1)" },
          "33%": { transform: "translate3d(3%,-4%,0) scale(1.06)" },
          "66%": { transform: "translate3d(-3%,3%,0) scale(0.96)" },
        },
        shimmer: {
          "100%": { transform: "translateX(100%)" },
        },
        // Terminal caret, used by the type-writer component.
        blink: { "0%,100%": { opacity: "1" }, "50%": { opacity: "0" } },
        // The ui-layouts marquee: one copy of the track slides out by its own
        // width plus the gap, at which point the next copy is exactly where it
        // started, so the loop is seamless.
        marquee: {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(calc(-100% - var(--gap)))" },
        },
        "marquee-vertical": {
          from: { transform: "translateY(0)" },
          to: { transform: "translateY(calc(-100% - var(--gap)))" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        flash: "flash 0.6s ease-out",
        drift: "drift 22s ease-in-out infinite",
        "drift-slow": "drift 34s ease-in-out infinite",
        shimmer: "shimmer 1.8s infinite",
        blink: "blink 1s step-end infinite",
        marquee: "marquee var(--duration) linear infinite",
        "marquee-reverse": "marquee var(--duration) linear infinite reverse",
        "marquee-vertical": "marquee-vertical var(--duration) linear infinite",
        "marquee-vertical-reverse":
          "marquee-vertical var(--duration) linear infinite reverse",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
