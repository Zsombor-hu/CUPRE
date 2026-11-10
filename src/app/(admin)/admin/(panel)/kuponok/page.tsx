import type { Metadata } from "next";
import CouponAdmin from "@/components/admin/coupon-admin";

export const metadata: Metadata = {
  title: "Kuponok admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a kuponokhoz (ADMIN_PASSWORD-del védett, a tartalmat a kliens tölti be)
export default function CouponAdminPage() {
  return (
    <>
      <CouponAdmin />
    </>
  );
}
