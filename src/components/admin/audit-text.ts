import type { AdminDictionary } from "@/components/admin/admin-i18n";
import type { AuditEntry } from "@/types/admin-audit";

// Egy napló-bejegyzés műveletének felirata a választott nyelven (ismeretlen műveletnél maga a kód)
export function auditActionLabel(t: AdminDictionary, entry: AuditEntry): string {
  const actions: Record<string, string> = t.audit.actions;
  return actions[entry.action] ?? entry.action;
}

// Rövid, olvasható összefoglaló a bejegyzés részleteiből (a napló táblázatához és a rendelés idővonalához)
export function auditDetails(t: AdminDictionary, entry: AuditEntry): string {
  const d = entry.details;
  const statuses: Record<string, string> = t.orders.statuses;
  // Rendelésállapot: honnan hová
  if (entry.action === "order.status") {
    return `${statuses[String(d.from)] ?? String(d.from)} → ${statuses[String(d.to)] ?? String(d.to)}${d.note ? ` (${String(d.note)})` : ""}`;
  }
  // Csomagkövetési szám
  if (entry.action === "order.tracking") {
    return String(d.tracking || "–");
  }
  // Számla
  if (entry.action === "order.invoice") {
    return String(d.invoiceNumber || "–");
  }
  // Változat: a megváltozott mezők előtte → utána
  if (entry.action === "variant.update" || entry.action === "product.update") {
    const before = (d.before ?? {}) as Record<string, unknown>;
    const after = (d.after ?? {}) as Record<string, unknown>;
    const labels: Record<string, string> = t.audit.fields;
    return Object.keys(labels)
      .filter((key) => key in after && JSON.stringify(before[key]) !== JSON.stringify(after[key]))
      .map((key) => `${labels[key]}: ${before[key] ?? "–"} → ${after[key] ?? "–"}`)
      .join(", ");
  }
  // Kupon: a kód
  if (entry.action.startsWith("coupon.")) {
    const coupon = (d.coupon ?? d.after ?? d.before ?? {}) as Record<string, unknown>;
    return String(coupon.code ?? "");
  }
  return "";
}
