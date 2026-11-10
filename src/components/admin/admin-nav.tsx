"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// Az admin oldalak listája
const PAGES = [
  { href: "/admin/rendelesek", label: "Rendelések" },
  { href: "/admin/kuponok", label: "Kuponok" },
  { href: "/admin/hirlevel", label: "Hírlevél" },
];

// Közös admin menü (az aktuális oldal kiemelve)
export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-2 text-sm" aria-label="Admin menü">
      {PAGES.map((page) => (
        <Link
          key={page.href}
          href={page.href}
          className={`rounded-full border px-3 py-1 ${pathname === page.href ? "border-foreground font-semibold" : "border-foreground/20"}`}
        >
          {page.label}
        </Link>
      ))}
    </nav>
  );
}
