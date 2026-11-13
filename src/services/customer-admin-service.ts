import "server-only";
import { getCustomerDb, inTransaction } from "@/services/customer-db";
import { deleteSubscriberByEmail } from "@/services/newsletter-service";
import { text } from "@/lib/validation";
import type { AdminCustomerDetail, AdminCustomerListItem } from "@/types/admin-customer";

// Az anonimizált ügyfél e-mail címének tartománya (nem kézbesíthető, a fenntartott .invalid TLD)
const ANONYMIZED_DOMAIN = "anonimizalt.invalid";

// Lista lekérdezés: ügyfél, fiók, rendelési összesítő, hírlevél-állapot
const LIST_SELECT = `
  SELECT c.id, c.name, c.email, c.phone, c.city, c.postcode, c.address, c.created_at AS createdAt,
    a.id AS accountId, a.disabled_at AS disabledAt, a.last_login_at AS lastLoginAt,
    (SELECT COUNT(*) FROM orders o WHERE o.customer_id = c.id) AS orderCount,
    (SELECT COALESCE(SUM(o.total_huf), 0) FROM orders o WHERE o.customer_id = c.id AND o.status <> 'canceled') AS totalSpentHuf,
    (SELECT MAX(o.created_at) FROM orders o WHERE o.customer_id = c.id) AS lastOrderAt,
    (SELECT n.status FROM newsletter_subscribers n WHERE n.email = c.email) AS newsletter
  FROM customers c LEFT JOIN accounts a ON a.customer_id = c.id`;

// Nyers sor
type CustomerRow = Omit<AdminCustomerListItem, "anonymized"> & { postcode: string; address: string; lastLoginAt: string | null };

// Sor → listaelem (a számok a SQLite-ból bigintként is jöhetnek)
function toListItem(row: CustomerRow): AdminCustomerListItem {
  return {
    id: Number(row.id),
    name: row.name,
    email: row.email,
    phone: row.phone,
    city: row.city,
    createdAt: row.createdAt,
    accountId: row.accountId === null ? null : Number(row.accountId),
    disabledAt: row.disabledAt,
    anonymized: row.email.endsWith(`@${ANONYMIZED_DOMAIN}`),
    orderCount: Number(row.orderCount),
    totalSpentHuf: Number(row.totalSpentHuf),
    lastOrderAt: row.lastOrderAt,
    newsletter: row.newsletter,
  };
}

// Vásárlók listája (keresés: név, e-mail, telefon, település), a legutóbb vásárolt / regisztrált elöl, legfeljebb 1000
export function listCustomers(query: string | null): AdminCustomerListItem[] {
  const q = text(query, 100).replace(/[%_]/g, "");
  const where = q ? "WHERE c.name LIKE ? OR c.email LIKE ? OR c.phone LIKE ? OR c.city LIKE ?" : "";
  const like = `%${q}%`;
  const rows = getCustomerDb()
    .prepare(`${LIST_SELECT} ${where} ORDER BY COALESCE(lastOrderAt, c.created_at) DESC LIMIT 1000`)
    .all(...(q ? [like, like, like, like] : [])) as CustomerRow[];
  return rows.map(toListItem);
}

// Egy vásárló részletei a rendeléseivel
export function getCustomerDetail(id: number): AdminCustomerDetail | null {
  const db = getCustomerDb();
  const row = db.prepare(`${LIST_SELECT} WHERE c.id = ?`).get(id) as CustomerRow | undefined;
  // Ismeretlen vásárló
  if (!row) {
    return null;
  }
  return {
    ...toListItem(row),
    postcode: row.postcode,
    address: row.address,
    lastLoginAt: row.lastLoginAt,
    orders: (
      db
        .prepare(
          "SELECT id, created_at AS createdAt, status, total_huf AS totalHuf, invoice_number AS invoiceNumber FROM orders WHERE customer_id = ? ORDER BY id DESC",
        )
        .all(id) as AdminCustomerDetail["orders"]
    ).map((order) => ({ ...order, id: Number(order.id), totalHuf: Number(order.totalHuf) })),
  };
}

// Fiók letiltása vagy engedélyezése; letiltáskor a vásárló minden munkamenete megszűnik. A válasz: volt-e fiók.
export function setCustomerDisabled(id: number, disabled: boolean): boolean {
  const account = getCustomerDb().prepare("SELECT id FROM accounts WHERE customer_id = ?").get(id) as { id: number } | undefined;
  // Vendég vásárlónak nincs fiókja
  if (!account) {
    return false;
  }
  inTransaction((db) => {
    db.prepare("UPDATE accounts SET disabled_at = CASE WHEN ? = 1 THEN datetime('now') ELSE NULL END WHERE id = ?").run(disabled ? 1 : 0, account.id);
    // Letiltáskor a belépett munkamenetek is megszűnnek
    if (disabled) {
      db.prepare("DELETE FROM sessions WHERE kind = 'customer' AND account_id = ?").run(account.id);
    }
  });
  return true;
}

// GDPR szerinti törlés (anonimizálás): a személyes adatok helyére semleges érték kerül az ügyfélen és a rendeléseken;
// a fiók, a munkamenetek és a hírlevél-feliratkozás törlődik. A rendelések összegei és tételei (számviteli adat) megmaradnak.
// A válasz: az eredeti e-mail cím (a naplóhoz), vagy null, ha nincs ilyen vásárló.
export function anonymizeCustomer(id: number): { email: string } | null {
  const customer = getCustomerDb().prepare("SELECT email FROM customers WHERE id = ?").get(id) as { email: string } | undefined;
  // Ismeretlen vásárló
  if (!customer) {
    return null;
  }
  inTransaction((db) => {
    const account = db.prepare("SELECT id FROM accounts WHERE customer_id = ?").get(id) as { id: number } | undefined;
    // A fiók és a hozzá tartozó munkamenetek, jelszó-visszaállítások törlése
    if (account) {
      db.prepare("DELETE FROM sessions WHERE kind = 'customer' AND account_id = ?").run(account.id);
      db.prepare("DELETE FROM accounts WHERE id = ?").run(account.id);
    }
    db.prepare(
      `UPDATE customers SET name = ?, email = ?, phone = '', postcode = '', city = '', address = '', updated_at = datetime('now') WHERE id = ?`,
    ).run("Anonimizált vásárló", `torolt-${id}@${ANONYMIZED_DOMAIN}`, id);
    db.prepare(
      `UPDATE orders SET ship_name = '', ship_phone = '', ship_postcode = '', ship_city = '', ship_address = '', note = '',
         pickup_point_id = NULL, pickup_point_name = NULL, pickup_point_address = NULL, account_id = NULL WHERE customer_id = ?`,
    ).run(id);
    db.prepare("UPDATE payment_events SET raw = '' WHERE order_id IN (SELECT id FROM orders WHERE customer_id = ?)").run(id);
  });
  deleteSubscriberByEmail(customer.email);
  return { email: customer.email };
}
