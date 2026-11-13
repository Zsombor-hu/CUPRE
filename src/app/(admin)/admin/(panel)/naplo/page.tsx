import type { Metadata } from "next";
import AuditAdmin from "@/components/admin/audit-admin";

export const metadata: Metadata = {
  title: "Napló admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal: az adminok módosításainak naplója (admin felhasználóval védett)
export default function AuditAdminPage() {
  return (
    <AuditAdmin />
  );
}
