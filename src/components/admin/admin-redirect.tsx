"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Lejárt vagy hiányzó admin munkamenetnél visszaviszi a látogatót a belépő oldalra
export default function AdminRedirect() {
  const router = useRouter();

  // Átirányítás a megjelenítés után
  useEffect(() => {
    router.replace("/admin");
  }, [router]);

  return <p className="text-foreground/60">Átirányítás a belépéshez…</p>;
}
