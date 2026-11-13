"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { notify } from "@/components/admin/admin-feedback";
import type { BackupStatus } from "@/types/admin-backup";
import { THEME_PALETTE_OPTIONS } from "@/components/theme-switcher";
import { LOCALES, hasLocale } from "@/lib/i18n";
import { PAGE_SIZES, THEME_MODES, type AdminSettings, type ThemeMode, type ThemePalette } from "@/types/admin-settings";

// Közös legördülő mező osztály
const SELECT = "w-full rounded-lg border border-foreground/20 bg-transparent px-3 py-2 sm:max-w-xs";

// Bájtszám olvasható méretként (KB / MB)
function formatSize(bytes: number, intl: string): string {
  // Megabájt fölött MB-ban
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toLocaleString(intl, { maximumFractionDigits: 1 })} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString(intl)} KB`;
}

// Adatbázis-mentések: állapot (utolsó, következő automatikus), azonnali mentés, letöltés
function BackupsCard() {
  const { t, fmt, when, lang } = useAdminI18n();
  const b = t.settings.backups;
  const [status, setStatus] = useState<BackupStatus | null>(null);
  const [busy, setBusy] = useState(false);

  // Állapot betöltése
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/backups", { cache: "no-store" });
    // Sikertelen betöltésnél a kártya üres marad
    if (response.ok) {
      setStatus((await response.json()) as BackupStatus);
    }
  }, []);

  // Első betöltés
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az állapot csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Azonnali (kézi) mentés
  async function backupNow() {
    setBusy(true);
    const response = await fetch("/api/admin/backups", { method: "POST" });
    setBusy(false);
    // Sikertelen mentés
    if (!response.ok) {
      notify.error(b.failed);
      return;
    }
    const data = (await response.json()) as { backup: { name: string }; status: BackupStatus };
    setStatus(data.status);
    notify.success(fmt(b.created, { name: data.backup.name }));
  }

  return (
    <Card className="max-w-2xl">
      <Card.Header>
        <Card.Title>{b.title}</Card.Title>
        <Card.Description>{status ? fmt(b.description, { hours: status.intervalHours, keep: status.keep }) : t.common.loading}</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-3 text-sm">
        {status ? (
          <>
            <div className="flex flex-col gap-0.5">
              <span className="font-semibold">{status.lastBackupAt ? fmt(b.last, { date: when(status.lastBackupAt) }) : b.none}</span>
              {status.nextBackupAt ? <span className="text-foreground/60">{fmt(b.next, { date: when(status.nextBackupAt) })}</span> : null}
              <span className="text-foreground/60">{fmt(b.total, { count: status.files.length, size: formatSize(status.totalBytes, lang) })}</span>
            </div>
            <div>
              <Button size="sm" isDisabled={busy} onPress={() => void backupNow()}>
                {b.now}
              </Button>
            </div>
            <p className="text-xs text-foreground/60">{b.hint}</p>
            {status.files.length > 0 ? (
              <ul className="flex max-h-64 flex-col overflow-y-auto rounded-lg border border-foreground/10">
                {status.files.map((file) => (
                  <li key={file.name} className="flex flex-wrap items-center justify-between gap-2 border-b border-foreground/10 px-3 py-2 last:border-b-0">
                    <span className="min-w-0">
                      {when(file.createdAt)}
                      <span className="text-foreground/60">{` · ${b.kinds[file.kind]} · ${formatSize(file.sizeBytes, lang)}`}</span>
                    </span>
                    <a className="text-accent underline-offset-2 hover:underline" href={`/api/admin/backups?file=${encodeURIComponent(file.name)}`}>
                      {b.download}
                    </a>
                  </li>
                ))}
              </ul>
            ) : null}
          </>
        ) : null}
      </Card.Content>
    </Card>
  );
}

// Admin beállítások: nyelv, táblázatok lapmérete, téma (azonnal érvényes, a felhasználóhoz mentődik), adatbázis-mentések
export default function SettingsAdmin() {
  const { t, fmt, user, settings, updateSettings } = useAdminI18n();

  // Egy beállítás módosítása és mentése (az eredményről toast értesít)
  async function change(changes: Partial<AdminSettings>) {
    // Mentés a szerverre
    if (await updateSettings(changes)) {
      notify.success(t.settings.saved);
    } else {
      notify.error(t.settings.saveFailed);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{t.settings.title}</h1>
        <p className="text-sm text-foreground/60">{t.settings.description}</p>
        {user ? <p className="text-sm text-foreground/60">{fmt(t.settings.signedInAs, { user })}</p> : null}
      </div>
      <Card className="max-w-2xl">
        <Card.Content className="flex flex-col gap-5">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t.settings.language}</span>
            <select
              className={SELECT}
              value={settings.lang}
              onChange={(event) => {
                // Csak támogatott nyelvkód
                if (hasLocale(event.target.value)) {
                  void change({ lang: event.target.value });
                }
              }}
            >
              {LOCALES.map((code) => (
                <option key={code} value={code}>
                  {code.toUpperCase()} · {t.language.names[code]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-semibold">{t.settings.pageSize}</span>
            <select className={SELECT} value={settings.pageSize} onChange={(event) => void change({ pageSize: Number(event.target.value) })}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
            <span className="text-foreground/60">{t.settings.pageSizeHint}</span>
          </label>
          <fieldset className="flex flex-col gap-3 text-sm">
            <legend className="mb-1 font-semibold">{t.settings.theme}</legend>
            <label className="flex flex-col gap-1">
              {t.settings.themeMode}
              <select className={SELECT} value={settings.themeMode} onChange={(event) => void change({ themeMode: event.target.value as ThemeMode })}>
                {THEME_MODES.map((mode) => (
                  <option key={mode} value={mode}>
                    {t.theme.modes[mode]}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-col gap-1">
              {t.settings.themePalette}
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={t.settings.themePalette}>
                {THEME_PALETTE_OPTIONS.map((palette) => {
                  const selected = settings.themePalette === palette.id;
                  return (
                    <button
                      key={palette.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      className={`flex items-center gap-2 rounded-full border px-3 py-1 transition-colors ${selected ? "border-accent bg-accent font-semibold text-accent-foreground" : "border-foreground/20 hover:border-accent/60"}`}
                      onClick={() => void change({ themePalette: palette.id as ThemePalette })}
                    >
                      <span className="size-3 rounded-full border border-foreground/20" style={{ backgroundColor: palette.color }} />
                      {palette.label}
                    </button>
                  );
                })}
              </div>
            </div>
          </fieldset>
        </Card.Content>
      </Card>
      <BackupsCard />
    </div>
  );
}
