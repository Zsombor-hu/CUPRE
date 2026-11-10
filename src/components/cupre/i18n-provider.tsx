"use client";

import { createContext } from "react";
import type { Dictionary, Locale } from "@/lib/i18n";

// Az aktuális nyelv és szótár a kliens komponensek számára
export type I18nContextValue = {
  lang: Locale;
  dict: Dictionary;
};

export const I18nContext = createContext<I18nContextValue | null>(null);

// A layoutban kiválasztott nyelv és szótár továbbadása a kliens komponenseknek (fejléc, kosár, pénztár…)
export default function I18nProvider({
  lang,
  dict,
  children,
}: I18nContextValue & { children: React.ReactNode }) {
  return <I18nContext.Provider value={{ lang, dict }}>{children}</I18nContext.Provider>;
}
