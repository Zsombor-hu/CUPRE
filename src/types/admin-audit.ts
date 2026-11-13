// Az admin napló bejegyzéseinek típusai (a felirat az admin szótár audit.actions kulcsa)
export const AUDIT_ACTIONS = [
  "order.status",
  "order.markPaid",
  "order.tracking",
  "order.internalNote",
  "order.invoice",
  "coupon.create",
  "coupon.update",
  "coupon.delete",
  "product.update",
  "variant.update",
  "customer.disable",
  "customer.enable",
  "customer.anonymize",
  "newsletter.delete",
  "backup.create",
  "backup.download",
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

// Egy napló-bejegyzés
export type AuditEntry = {
  id: number;
  adminName: string;
  action: AuditAction;
  entity: string;
  entityId: string;
  details: Record<string, unknown>;
  createdAt: string;
};
