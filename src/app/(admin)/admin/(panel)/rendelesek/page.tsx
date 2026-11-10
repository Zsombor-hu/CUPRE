import type { Metadata } from "next";
import OrdersAdmin from "@/components/admin/orders-admin";

export const metadata: Metadata = {
  title: "Rendelések admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a rendelések kezeléséhez (ADMIN_PASSWORD-del védett, a tartalmat a kliens tölti be)
export default function OrdersAdminPage() {
  return (
    <>
      <OrdersAdmin />
    </>
  );
}
