"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, buttonVariants } from "@heroui/react";
import ThemeSwitcher from "@/components/theme-switcher";

// Az admin oldalak listája
const PAGES = [
  { href: "/admin/rendelesek", label: "Rendelések" },
  { href: "/admin/kuponok", label: "Kuponok" },
  { href: "/admin/hirlevel", label: "Hírlevél" },
];

// A belépést igénylő admin oldalak kerete: fejléc menüvel, téma- és kilépés gombbal; belépés nélkül a /admin oldalra irányít
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  // Munkamenet ellenőrzése: belépés nélkül vissza a belépő oldalra
  useEffect(() => {
    // Állapot lekérdezése az API-tól
    async function probe() {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as { configured: boolean; authenticated: boolean };
      // Nincs érvényes munkamenet vagy az admin ki van kapcsolva
      if (!data.authenticated) {
        router.replace("/admin");
        return;
      }
      setReady(true);
    }
    void probe();
  }, [router]);

  // Kilépés
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin");
  }

  // Ellenőrzés közben nem mutatunk adatot
  if (!ready) {
    return <p className="p-8 text-foreground/60">Betöltés…</p>;
  }

  return (
    <div className="min-h-screen bg-foreground/[0.03]">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <Link href="/admin/rendelesek" className="mr-2 flex flex-col leading-none">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">CUPRÉ</span>
            <span className="text-lg font-semibold">Admin</span>
          </Link>
          <nav className="flex flex-wrap gap-1" aria-label="Admin menü">
            {PAGES.map((page) => (
              <Link
                key={page.href}
                href={page.href}
                aria-current={pathname === page.href ? "page" : undefined}
                className={buttonVariants({ variant: pathname === page.href ? "primary" : "ghost", size: "sm" })}
              >
                {page.label}
              </Link>
            ))}
          </nav>
          <span className="flex-1" />
          <ThemeSwitcher />
          <Button size="sm" variant="secondary" onPress={() => void logout()}>
            Kilépés
          </Button>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
