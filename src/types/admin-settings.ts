import { LOCALES, type Locale } from "@/lib/i18n";

// Világos / sötét / rendszer mód
export const THEME_MODES = ["light", "dark", "system"] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

// A HeroUI színtémák azonosítói (a theme-switcher PALETTES listájával egyezik)
export const THEME_PALETTES = ["default", "sky", "lavender", "mint", "netflix", "uber", "spotify", "coinbase", "airbnb", "discord", "rabbit"] as const;
export type ThemePalette = (typeof THEME_PALETTES)[number];

// A táblázatokban választható lapméretek
export const PAGE_SIZES = [10, 25, 50, 100] as const;

// Admin felhasználónként mentett beállítások
export type AdminSettings = {
  lang: Locale;
  pageSize: number;
  themeMode: ThemeMode;
  themePalette: ThemePalette;
};

// Alapértelmezett beállítások (új felhasználó, vagy hiányzó/hibás mentett érték)
export const DEFAULT_ADMIN_SETTINGS: AdminSettings = { lang: "hu", pageSize: 25, themeMode: "system", themePalette: "default" };

// Tetszőleges (pl. JSON-ból olvasott) érték beállításokká alakítása: az érvénytelen mezők helyett a megadott alapérték marad
export function normalizeAdminSettings(value: unknown, base: AdminSettings = DEFAULT_ADMIN_SETTINGS): AdminSettings {
  const raw = (typeof value === "object" && value !== null ? value : {}) as Record<string, unknown>;
  return {
    lang: (LOCALES as readonly unknown[]).includes(raw.lang) ? (raw.lang as Locale) : base.lang,
    pageSize: (PAGE_SIZES as readonly unknown[]).includes(raw.pageSize) ? (raw.pageSize as number) : base.pageSize,
    themeMode: (THEME_MODES as readonly unknown[]).includes(raw.themeMode) ? (raw.themeMode as ThemeMode) : base.themeMode,
    themePalette: (THEME_PALETTES as readonly unknown[]).includes(raw.themePalette) ? (raw.themePalette as ThemePalette) : base.themePalette,
  };
}
