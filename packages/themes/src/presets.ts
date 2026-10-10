export type ThemePreset = {
  id: string;
  label: string;
  cssVariables: Record<string, string>;
};

/** White-label theme presets — apps select via NEXT_PUBLIC_THEME_PRESET */
export const themePresets: Record<string, ThemePreset> = {
  default: {
    id: "default",
    label: "MADSTOQ Default",
    cssVariables: {
      "--brand-primary": "221 83% 53%",
      "--brand-primary-foreground": "0 0% 100%",
      "--brand-accent": "142 76% 36%",
      "--brand-radius": "0.5rem",
    },
  },
  slate: {
    id: "slate",
    label: "Slate Professional",
    cssVariables: {
      "--brand-primary": "215 28% 17%",
      "--brand-primary-foreground": "0 0% 100%",
      "--brand-accent": "199 89% 48%",
      "--brand-radius": "0.375rem",
    },
  },
};

export function getThemePreset(id: string): ThemePreset {
  return themePresets[id] ?? themePresets.default!;
}
