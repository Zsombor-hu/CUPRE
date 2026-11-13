"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore } from "react";
import { Button, Dropdown, Label, type Selection } from "@heroui/react";
import hu from "@/data/i18n/admin/hu.json";
import en from "@/data/i18n/admin/en.json";
import de from "@/data/i18n/admin/de.json";
import { setTheme } from "@/components/theme-switcher";
import { LOCALES, NUMBER_LOCALES, hasLocale, interpolate, type Locale } from "@/lib/i18n";
import { DEFAULT_ADMIN_SETTINGS, normalizeAdminSettings, type AdminSettings } from "@/types/admin-settings";

// Az admin szótár szerkezete a magyarból származik; a `satisfies` miatt a build hibát ad, ha az angolból vagy németből hiányzik kulcs
export type AdminDictionary = typeof hu;
const DICTIONARIES: Record<Locale, AdminDictionary> = {
  hu,
  en: en satisfies AdminDictionary,
  de: de satisfies AdminDictionary,
};

// A legutóbb használt beállítások helyi másolata: belépés előtt (belépő oldal) és a szerverről töltés alatt ez érvényes.
// A mérvadó példány felhasználónként a szerveren van (/api/admin/settings).
const CACHE_KEY = "admin-settings";

// Feliratkozott figyelők a beállítások változásához (useSyncExternalStore)
const listeners = new Set<() => void>();

// Az aktuális beállítások (stabil hivatkozás a useSyncExternalStore-nak); null: még nincs beolvasva
let current: AdminSettings | null = null;

// A helyi másolat beolvasása (hiányzó vagy hibás érték esetén az alapértelmezések)
function readCache(): AdminSettings {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    return normalizeAdminSettings(raw ? JSON.parse(raw) : {});
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

// Az aktuális beállítások pillanatképe
function getSnapshot(): AdminSettings {
  // Első olvasáskor a helyi másolatból
  if (current === null) {
    current = readCache();
  }
  return current;
}

// Szerveroldali rendereléskor az alapértelmezések
function getServerSnapshot(): AdminSettings {
  return DEFAULT_ADMIN_SETTINGS;
}

// Feliratkozás a változásra (saját módosítás és más lapon történt módosítás)
function subscribe(listener: () => void) {
  // Másik lapon módosított helyi másolat: újraolvasás
  function onStorage(event: StorageEvent) {
    // Csak a saját kulcsunk változása érdekes
    if (event.key === CACHE_KEY) {
      current = null;
      listener();
    }
  }
  listeners.add(listener);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

// Új beállítások érvényesítése: helyi másolat, figyelők értesítése
function publish(next: AdminSettings) {
  current = next;
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch {
    // Mentés nélkül a beállítás csak az aktuális oldalbetöltésre érvényes
  }
  listeners.forEach((listener) => listener());
}

// Az admin nyelvi és beállítás-környezete
export type AdminI18n = {
  lang: Locale;
  t: AdminDictionary;
  settings: AdminSettings;
  // A belépett admin neve (a beállítások betöltése után), egyébként null
  user: string | null;
  // Beállítás módosítása: azonnal érvényes, belépett felhasználónál a szerverre is mentődik; a válasz: sikerült-e a mentés
  updateSettings: (changes: Partial<AdminSettings>) => Promise<boolean>;
  // A belépett felhasználó beállításainak betöltése; false, ha nincs (érvényes, névvel ellátott) admin munkamenet
  loadUserSettings: () => Promise<boolean>;
  // Kilépéskor a felhasználó elfelejtése
  clearUser: () => void;
  // Sablonkitöltés: fmt("{qty} db", { qty: 2 })
  fmt: (template: string, values: Record<string, string | number>) => string;
  // Forintösszeg a nyelv ezres tagolásával
  huf: (value: number) => string;
  // SQLite UTC időbélyeg vagy ISO dátum helyi dátum-időként
  when: (value: string | null) => string;
};

const AdminI18nContext = createContext<AdminI18n | null>(null);

// Az admin felület nyelvi és beállítás-környezete (nyelv, lapméret, téma; belépés után felhasználónként a szerverről)
export function AdminI18nProvider({ children }: { children: React.ReactNode }) {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [user, setUser] = useState<string | null>(null);
  const lang = settings.lang;

  // A <html lang> kövesse a választott nyelvet
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // Beállítások betöltése a szerverről (belépés után)
  const loadUserSettings = useCallback(async () => {
    const response = await fetch("/api/admin/settings", { cache: "no-store" });
    // Nincs névvel ellátott admin munkamenet
    if (!response.ok) {
      return false;
    }
    const data = (await response.json()) as { user: string; settings: unknown };
    const next = normalizeAdminSettings(data.settings);
    publish(next);
    setTheme(next.themeMode, next.themePalette);
    setUser(data.user);
    return true;
  }, []);

  // Beállítás módosítása helyben, belépett felhasználónál a szerveren is
  const updateSettings = useCallback(
    async (changes: Partial<AdminSettings>) => {
      const next = normalizeAdminSettings(changes, getSnapshot());
      publish(next);
      // A téma módosítása azonnal látszódjon
      if (changes.themeMode !== undefined || changes.themePalette !== undefined) {
        setTheme(next.themeMode, next.themePalette);
      }
      // Belépés nélkül (belépő oldal) csak helyben mentünk
      if (user === null) {
        return true;
      }
      const response = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      });
      return response.ok;
    },
    [user],
  );

  // Kilépéskor a felhasználó elfelejtése
  const clearUser = useCallback(() => setUser(null), []);

  const intl = NUMBER_LOCALES[lang];
  const value: AdminI18n = {
    lang,
    t: DICTIONARIES[lang],
    settings,
    user,
    updateSettings,
    loadUserSettings,
    clearUser,
    fmt: interpolate,
    huf: (amount) => `${amount.toLocaleString(intl)} Ft`,
    when: (raw) => {
      // Hiányzó időpont
      if (!raw) {
        return "–";
      }
      const date = new Date(/^\d{4}-\d{2}-\d{2} /.test(raw) ? `${raw.replace(" ", "T")}Z` : raw);
      return Number.isNaN(date.getTime()) ? raw : date.toLocaleString(intl);
    },
  };
  return <AdminI18nContext.Provider value={value}>{children}</AdminI18nContext.Provider>;
}

// Az admin nyelvi és beállítás-környezete kliens komponensből; provider nélkül fejlesztői hibát dob
export function useAdminI18n(): AdminI18n {
  const context = useContext(AdminI18nContext);
  // Provider nélküli használat programozási hiba
  if (!context) {
    throw new Error("A useAdminI18n csak AdminI18nProvider-en belül használható.");
  }
  return context;
}

// Nyelvválasztó a belépő oldalon (HU / EN / DE); belépés után a Beállítások oldalon állítható
export function AdminLanguageSwitcher() {
  const { lang, t, updateSettings } = useAdminI18n();

  // A menüből kiválasztott nyelv mentése
  function handleSelectionChange(keys: Selection) {
    const [selected] = Array.from(keys);
    // Csak támogatott nyelvkódra váltunk
    if (typeof selected === "string" && hasLocale(selected)) {
      void updateSettings({ lang: selected });
    }
  }

  return (
    <Dropdown>
      <Button aria-label={`${t.language.label}: ${t.language.names[lang]}`} variant="secondary" size="sm">
        {lang.toUpperCase()}
      </Button>
      <Dropdown.Popover>
        <Dropdown.Menu selectedKeys={new Set([lang])} selectionMode="single" onSelectionChange={handleSelectionChange}>
          {LOCALES.map((code) => (
            <Dropdown.Item key={code} id={code} textValue={t.language.names[code]}>
              <Dropdown.ItemIndicator />
              <Label>
                {code.toUpperCase()} · {t.language.names[code]}
              </Label>
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
