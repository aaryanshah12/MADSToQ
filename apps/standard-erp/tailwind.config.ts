import type { Config } from "tailwindcss";
import sharedPreset from "@madstoq/themes/tailwind";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
    "../../packages/inventory-system/src/**/*.{ts,tsx}",
  ],
  presets: [sharedPreset as Config],
  theme: {
    extend: {
      fontFamily: {
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
        display: ["var(--font-display)", "sans-serif"],
        body: ["var(--font-body)", "sans-serif"],
      },
      colors: {
        bg: "var(--color-bg)",
        panel: "var(--color-panel)",
        border: "var(--color-border)",
        text: "var(--color-text)",
        muted: "var(--color-muted)",
        primary: "var(--color-text)",
        owner: "var(--color-owner)",
        inputer: "var(--color-inputer)",
        chemist: "var(--color-chemist)",
        pmc: "var(--color-pmc)",
        layer: {
          DEFAULT: "color-mix(in srgb, var(--color-text) 6%, transparent)",
          sm: "color-mix(in srgb, var(--color-text) 4%, transparent)",
          xs: "color-mix(in srgb, var(--color-text) 2%, transparent)",
        },
        canvas: "rgb(var(--crm-canvas) / <alpha-value>)",
        surface: "rgb(var(--crm-surface) / <alpha-value>)",
        "surface-2": "rgb(var(--crm-surface-2) / <alpha-value>)",
        ink: "rgb(var(--crm-ink) / <alpha-value>)",
        "ink-muted": "rgb(var(--crm-ink-muted) / <alpha-value>)",
        "ink-faint": "rgb(var(--crm-ink-faint) / <alpha-value>)",
        line: "rgb(var(--crm-line) / <alpha-value>)",
        "line-strong": "rgb(var(--crm-line-strong) / <alpha-value>)",
        "brand-soft": "rgb(var(--crm-brand-soft) / <alpha-value>)",
        "brand-ink": "rgb(var(--crm-brand-ink) / <alpha-value>)",
        "accent-soft": "rgb(var(--crm-accent-soft) / <alpha-value>)",
        success: "rgb(var(--crm-success) / <alpha-value>)",
        "success-soft": "rgb(var(--crm-success-soft) / <alpha-value>)",
        warn: "rgb(var(--crm-warn) / <alpha-value>)",
        "warn-soft": "rgb(var(--crm-warn-soft) / <alpha-value>)",
        danger: "rgb(var(--crm-danger) / <alpha-value>)",
        sidebar: "rgb(var(--crm-sidebar) / <alpha-value>)",
        "sidebar-ink": "rgb(var(--crm-sidebar-ink) / <alpha-value>)",
        "sidebar-muted": "rgb(var(--crm-sidebar-muted) / <alpha-value>)",
        "sidebar-active": "rgb(var(--crm-sidebar-active) / <alpha-value>)",
      },
    },
  },
};

export default config;
