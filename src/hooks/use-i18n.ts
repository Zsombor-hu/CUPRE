"use client";

import { useContext } from "react";
import { I18nContext, type I18nContextValue } from "@/components/cupre/i18n-provider";

// Az aktuális nyelv és szótár elérése kliens komponensből; provider nélkül fejlesztői hibát dob
export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  // Provider nélküli használat programozási hiba, ezt azonnal jelezzük
  if (!context) {
    throw new Error("A useI18n csak I18nProvider-en belül használható.");
  }
  return context;
}
