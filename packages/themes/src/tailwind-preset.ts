import type { Config } from "tailwindcss";

/** Shared Tailwind preset — extend in app tailwind.config.ts */
const preset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "hsl(var(--brand-primary) / <alpha-value>)",
          foreground: "hsl(var(--brand-primary-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--brand-accent) / <alpha-value>)",
        },
      },
      borderRadius: {
        brand: "var(--brand-radius)",
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
    },
  },
};

export default preset;
