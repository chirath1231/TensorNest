import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      keyframes: {
        "fade-in": { from: { opacity: "0" }, to: { opacity: "1" } },
        "flash": {
          "0%": { backgroundColor: "rgba(6,182,212,0.12)" },
          "100%": { backgroundColor: "transparent" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.15s ease-out",
        flash: "flash 0.6s ease-out",
      },
    },
  },
  plugins: [require("@tailwindcss/typography")],
};

export default config;
