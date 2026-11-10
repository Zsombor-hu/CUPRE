import { buildXlsx } from "@/lib/xlsx";
import "server-only";
import { createToken, hashToken } from "@/services/auth-service";
import { getCustomerDb } from "@/services/customer-db";
import { sendNewsletterConfirmation } from "@/services/mail-service";
import type { Locale } from "@/lib/i18n";
import type { NewsletterSource, NewsletterStatus, NewsletterSubscriber } from "@/types/account";

// Adatbázis-sor → admin listaelem
type SubscriberRow = {
  id: number;
  email: string;
  name: string;
  lang: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  consent_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  created_at: string;
};

// Sor átalakítása a kliens felé küldött formára
function toSubscriber(row: SubscriberRow): NewsletterSubscriber {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    lang: row.lang,
    status: row.status,
    source: row.source,
    consentAt: row.consent_at,
    confirmedAt: row.confirmed_at,
    unsubscribedAt: row.unsubscribed_at,
    createdAt: row.created_at,
  };
}

// Feliratkozás (dupla opt-in): új vagy korábban leiratkozott címnél „pending” állapot és megerősítő levél;
// már aktív címnél nem történik semmi (és ezt kifelé sem áruljuk el)
export function subscribe(input: { email: string; name: string; lang: Locale; source: NewsletterSource }): void {
  const db = getCustomerDb();
  const existing = db.prepare("SELECT status FROM newsletter_subscribers WHERE email = ?").get(input.email) as
    | { status: NewsletterStatus }
    | undefined;
  // Aktív feliratkozót nem kell újra megerősíttetni
  if (existing?.status === "active") {
    return;
  }
  const token = createToken();
  db.prepare(
    `INSERT INTO newsletter_subscribers (email, name, lang, status, token_hash, source, consent_at)
     VALUES (?, ?, ?, 'pending', ?, ?, datetime('now'))
     ON CONFLICT(email) DO UPDATE SET name = excluded.name, lang = excluded.lang, status = 'pending',
       token_hash = excluded.token_hash, source = excluded.source, consent_at = datetime('now'),
       confirmed_at = NULL, unsubscribed_at = NULL`,
  ).run(input.email, input.name, input.lang, hashToken(token), input.source);
  sendNewsletterConfirmation({ email: input.email, name: input.name, lang: input.lang, token });
}

// Feliratkozás megerősítése a levélben kapott tokennel
export function confirmSubscription(token: string): boolean {
  const result = getCustomerDb()
    .prepare(
      `UPDATE newsletter_subscribers SET status = 'active', confirmed_at = datetime('now'), unsubscribed_at = NULL
       WHERE token_hash = ? AND status IN ('pending', 'active')`,
    )
    .run(hashToken(token));
  return Number(result.changes) > 0;
}

// Leiratkozás a levélben kapott tokennel
export function unsubscribeByToken(token: string): boolean {
  const result = getCustomerDb()
    .prepare(
      `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now')
       WHERE token_hash = ?`,
    )
    .run(hashToken(token));
  return Number(result.changes) > 0;
}

// Leiratkozás e-mail cím alapján (belépett ügyfél a fiókjából)
export function unsubscribeEmail(email: string): void {
  getCustomerDb()
    .prepare(
      `UPDATE newsletter_subscribers SET status = 'unsubscribed', unsubscribed_at = datetime('now')
       WHERE email = ? AND status != 'unsubscribed'`,
    )
    .run(email);
}

// Feliratkozás állapota egy e-mail címhez (null: soha nem iratkozott fel)
export function subscriptionStatus(email: string): NewsletterStatus | null {
  const row = getCustomerDb().prepare("SELECT status FROM newsletter_subscribers WHERE email = ?").get(email) as
    | { status: NewsletterStatus }
    | undefined;
  return row?.status ?? null;
}

// Feliratkozó végleges törlése (fióktörlés vagy admin kérés – GDPR törlési jog)
export function deleteSubscriberByEmail(email: string): void {
  getCustomerDb().prepare("DELETE FROM newsletter_subscribers WHERE email = ?").run(email);
}

// Admin: feliratkozó törlése azonosító alapján
export function deleteSubscriber(id: number): boolean {
  const result = getCustomerDb().prepare("DELETE FROM newsletter_subscribers WHERE id = ?").run(id);
  return Number(result.changes) > 0;
}

// Admin: feliratkozók listája (opcionális állapotszűréssel), a legújabb elöl
export function listSubscribers(status?: NewsletterStatus): NewsletterSubscriber[] {
  const db = getCustomerDb();
  const rows = (
    status
      ? db.prepare("SELECT * FROM newsletter_subscribers WHERE status = ? ORDER BY created_at DESC, id DESC").all(status)
      : db.prepare("SELECT * FROM newsletter_subscribers ORDER BY created_at DESC, id DESC").all()
  ) as SubscriberRow[];
  return rows.map(toSubscriber);
}

// Admin: darabszámok állapotonként
export function subscriberCounts(): Record<NewsletterStatus, number> {
  const rows = getCustomerDb()
    .prepare("SELECT status, COUNT(*) AS count FROM newsletter_subscribers GROUP BY status")
    .all() as { status: NewsletterStatus; count: number }[];
  const counts: Record<NewsletterStatus, number> = { pending: 0, active: 0, unsubscribed: 0 };
  // A hiányzó állapotok 0-val maradnak
  for (const row of rows) {
    counts[row.status] = Number(row.count);
  }
  return counts;
}

// CSV mező idézése (vessző, idézőjel, sortörés, valamint táblázatkezelőben képletként értelmezhető kezdőkarakterek ellen)
function csvField(value: string): string {
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

// Az export táblázata: fejléc + sorok (CSV-hez és Excelhez közös)
function subscribersTable(status?: NewsletterStatus): { header: string[]; rows: string[][] } {
  const header = ["email", "name", "lang", "status", "source", "consent_at", "confirmed_at", "unsubscribed_at"];
  const rows = listSubscribers(status).map((s) => [s.email, s.name, s.lang, s.status, s.source, s.consentAt, s.confirmedAt ?? "", s.unsubscribedAt ?? ""]);
  return { header, rows };
}

// Admin: CSV export (a külső hírlevélküldő szolgáltatóba importáláshoz); UTF-8 BOM-mal, hogy az Excel is jól olvassa
export function subscribersCsv(status?: NewsletterStatus): string {
  const { header, rows } = subscribersTable(status);
  const lines = rows.map((row) => row.map(csvField).join(","));
  return `﻿${[header.join(","), ...lines].join("\r\n")}\r\n`;
}

// Admin: feliratkozók Excel (.xlsx) fájlban
export function subscribersXlsx(status?: NewsletterStatus): Buffer {
  const { header, rows } = subscribersTable(status);
  return buildXlsx("Feliratkozók", header, rows);
}
