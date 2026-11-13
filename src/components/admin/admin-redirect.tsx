"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminI18n } from "@/components/admin/admin-i18n";

// Lejárt vagy hiányzó admin munkamenetnél visszaviszi a látogatót a belépő oldalra
export default function AdminRedirect() {
  const router = useRouter();
  const { t } = useAdminI18n();

  // Átirányítás a megjelenítés után
  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return <p className="text-foreground/60">{t.common.redirecting}</p>;
}
