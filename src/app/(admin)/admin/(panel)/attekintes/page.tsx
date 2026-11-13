import type { Metadata } from "next";
import DashboardAdmin from "@/components/admin/dashboard-admin";

export const metadata: Metadata = {
  title: "Áttekintés admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin kezdőoldal: bevétel, teendők, napi grafikon, toplista, alacsony készlet (admin felhasználóval védett)
export default function DashboardAdminPage() {
  return (
    <DashboardAdmin />
  );
}
