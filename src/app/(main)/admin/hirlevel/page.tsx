import type { Metadata } from "next";
import NewsletterAdmin from "@/components/admin/newsletter-admin";

export const metadata: Metadata = {
  title: "Hírlevél admin | CUPRÉ",
  robots: { index: false, follow: false },
};

// Belső admin oldal a hírlevél-feliratkozókhoz (ADMIN_PASSWORD-del védett, a tartalmat a kliens tölti be)
export default function NewsletterAdminPage() {
  return (
    <div className="flex flex-1 justify-center p-6">
      <NewsletterAdmin />
    </div>
  );
}
