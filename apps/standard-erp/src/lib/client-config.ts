/** Client deployment config — lives in the app, not shared packages */
export const clientConfig = {
  id: process.env.CLIENT_ID ?? "default",
  slug: process.env.CLIENT_SLUG ?? "default",
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "MADSTOQ ERP",
  themePreset: process.env.NEXT_PUBLIC_THEME_PRESET ?? "default",
} as const;
