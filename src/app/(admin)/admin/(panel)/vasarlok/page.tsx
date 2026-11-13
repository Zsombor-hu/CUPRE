import { Suspense } from "react";
import type { Metadata } from "next";
import CustomersAdmin from "@/components/admin/customers-admin";

export const metadata: Metadata = {
  title: "Vásárlók admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a vásárlókhoz (az URL ?id= paramétere miatt Suspense-ben) (admin felhasználóval védett)
export default function CustomersAdminPage() {
  return (
    <Suspense>
      <CustomersAdmin />
    </Suspense>
  );
}
