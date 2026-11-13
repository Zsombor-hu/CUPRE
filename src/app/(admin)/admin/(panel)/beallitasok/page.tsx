import type { Metadata } from "next";
import SettingsAdmin from "@/components/admin/settings-admin";

export const metadata: Metadata = {
  title: "Beállítások admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a felhasználónkénti beállításokhoz: nyelv, lapméret, téma (admin felhasználóval védett)
export default function SettingsAdminPage() {
  return <SettingsAdmin />;
}
