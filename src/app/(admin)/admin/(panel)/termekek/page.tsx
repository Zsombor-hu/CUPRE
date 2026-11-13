import type { Metadata } from "next";
import ProductsAdmin from "@/components/admin/products-admin";

export const metadata: Metadata = {
  title: "Termékek és készlet admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a termékek árához, rendelhetőségéhez és készletéhez (admin felhasználóval védett)
export default function ProductsAdminPage() {
  return (
    <ProductsAdmin />
  );
}
