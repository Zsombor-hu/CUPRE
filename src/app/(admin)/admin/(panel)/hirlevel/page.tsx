import type { Metadata } from "next";
import NewsletterAdmin from "@/components/admin/newsletter-admin";

export const metadata: Metadata = {
  title: "Hírlevél admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a hírlevél-feliratkozókhoz (admin felhasználóval védett, a tartalmat a kliens tölti be)
export default function NewsletterAdminPage() {
  return (
    <>
      <NewsletterAdmin />
    </>
  );
}
