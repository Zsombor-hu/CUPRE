import "server-only";
import { getCustomerDb } from "@/services/customer-db";
import type { AuditAction, AuditEntry } from "@/types/admin-audit";

// Legfeljebb ennyi bejegyzést adunk vissza egy lekérdezésben
const MAX_ENTRIES = 1000;

// Nyers napló-sor
type AuditRow = {
  id: number;
  adminName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  details: string;
  createdAt: string;
};

// Sor → bejegyzés (a részletek JSON-ként tárolódnak; hibás JSON esetén üres objektum)
function toEntry(row: AuditRow): AuditEntry {
  let details: Record<string, unknown> = {};
  // A részletek opcionálisak, a sérült érték nem akadályozhatja a listázást
  try {
    const parsed: unknown = row.details ? JSON.parse(row.details) : {};
    details = typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    details = {};
  }
  return { ...row, details };
}

// Admin művelet naplózása: ki, mit, melyik elemen, milyen részletekkel
export function logAdminAction(
  adminName: string,
  action: AuditAction,
  entity: string,
  entityId: string | number,
  details: Record<string, unknown> = {},
): void {
  getCustomerDb()
    .prepare("INSERT INTO admin_audit (admin_name, action, entity, entity_id, details) VALUES (?, ?, ?, ?, ?)")
    .run(adminName, action, entity, String(entityId), JSON.stringify(details));
}

// Napló-bejegyzések a legújabb elöl; opcionálisan egy elemre (pl. order + id) szűrve
export function listAudit(filter: { entity?: string; entityId?: string | number } = {}): AuditEntry[] {
  const conditions: string[] = [];
  const params: string[] = [];
  // Elem típusa szerinti szűrés
  if (filter.entity) {
    conditions.push("entity = ?");
    params.push(filter.entity);
  }
  // Elem azonosítója szerinti szűrés
  if (filter.entityId !== undefined) {
    conditions.push("entity_id = ?");
    params.push(String(filter.entityId));
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = getCustomerDb()
    .prepare(
      `SELECT id, admin_name AS adminName, action, entity, entity_id AS entityId, details, created_at AS createdAt
       FROM admin_audit ${where} ORDER BY id DESC LIMIT ${MAX_ENTRIES}`,
    )
    .all(...params) as AuditRow[];
  return rows.map(toEntry);
}
