import "server-only";
import { getCustomerDb } from "@/services/customer-db";
import { normalizeAdminSettings, type AdminSettings } from "@/types/admin-settings";

// Egy admin felhasználó mentett beállításai (ha még nincs mentés, az alapértelmezések)
export function getAdminSettings(adminName: string): AdminSettings {
  const row = getCustomerDb().prepare("SELECT settings FROM admin_settings WHERE admin_name = ?").get(adminName) as
    | { settings: string }
    | undefined;
  // Még nem mentett beállítást
  if (!row) {
    return normalizeAdminSettings({});
  }
  try {
    return normalizeAdminSettings(JSON.parse(row.settings));
  } catch {
    return normalizeAdminSettings({});
  }
}

// Beállítások módosítása: a kapott (akár részleges) értékek a meglévőkre kerülnek, az érvénytelen mezők változatlanok maradnak
export function saveAdminSettings(adminName: string, changes: unknown): AdminSettings {
  const next = normalizeAdminSettings(changes, getAdminSettings(adminName));
  getCustomerDb()
    .prepare(
      `INSERT INTO admin_settings (admin_name, settings, updated_at) VALUES (?, ?, datetime('now'))
       ON CONFLICT(admin_name) DO UPDATE SET settings = excluded.settings, updated_at = excluded.updated_at`,
    )
    .run(adminName, JSON.stringify(next));
  return next;
}
