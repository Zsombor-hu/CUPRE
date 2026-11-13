import { Suspense } from "react";
import type { Metadata } from "next";
import OrdersAdmin from "@/components/admin/orders-admin";

export const metadata: Metadata = {
  title: "Rendelések admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a rendelések kezeléséhez (admin felhasználóval védett, a tartalmat a kliens tölti be; az URL szűrőparaméterei miatt Suspense-ben)
export default function OrdersAdminPage() {
  return (
    <Suspense>
      <OrdersAdmin />
    </Suspense>
  );
}
