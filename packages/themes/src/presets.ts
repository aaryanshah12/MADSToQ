export type ThemePreset = 'default' | 'sales-light' | 'sales-dark'

export const themePresets: Record<ThemePreset, Record<string, string>> = {
  default: {},
  'sales-light': {},
  'sales-dark': {},
}

export function getThemePreset(id: ThemePreset) {
  return themePresets[id] ?? themePresets.default
}
