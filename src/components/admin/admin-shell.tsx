"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Button, Drawer, buttonVariants } from "@heroui/react";
import { useAdminI18n, type AdminDictionary } from "@/components/admin/admin-i18n";

// Az admin oldalak listája (a felirat a szótár shell.pages kulcsa)
const PAGES: { href: string; key: keyof AdminDictionary["shell"]["pages"] }[] = [
  { href: "/admin/attekintes", key: "dashboard" },
  { href: "/admin/rendelesek", key: "orders" },
  { href: "/admin/termekek", key: "products" },
  { href: "/admin/vasarlok", key: "customers" },
  { href: "/admin/kuponok", key: "coupons" },
  { href: "/admin/hirlevel", key: "newsletter" },
  { href: "/admin/naplo", key: "audit" },
  { href: "/admin/beallitasok", key: "settings" },
];

// Hamburger ikon (három vízszintes vonal)
function MenuIcon() {
  return (
    <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}

// A belépést igénylő admin oldalak kerete: fejléc hamburgermenüvel (bal oldali fiók); belépés után betölti a felhasználó
// beállításait (nyelv, lapméret, téma); belépés nélkül a /admin oldalra irányít
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { t, user, loadUserSettings, clearUser } = useAdminI18n();
  const [ready, setReady] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  // Munkamenet ellenőrzése és a felhasználó beállításainak betöltése; belépés nélkül vissza a belépő oldalra
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
      // Régi, felhasználónév nélküli munkamenet: újra be kell lépni, hogy a beállítások a felhasználóhoz kötődjenek
      if (!(await loadUserSettings())) {
        await fetch("/api/admin/logout", { method: "POST" });
        router.replace("/admin");
        return;
      }
      setReady(true);
    }
    void probe();
  }, [router, loadUserSettings]);

  // Kilépés
  async function logout() {
    setMenuOpen(false);
    await fetch("/api/admin/logout", { method: "POST" });
    clearUser();
    router.replace("/admin");
  }

  // Ellenőrzés közben nem mutatunk adatot
  if (!ready) {
    return <p className="p-8 text-foreground/60">{t.common.loading}</p>;
  }

  const current = PAGES.find((page) => page.href === pathname);
  return (
    <div className="min-h-screen bg-foreground/[0.03]">
      <header className="sticky top-0 z-10 border-b border-foreground/10 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6">
          <Button isIconOnly variant="ghost" aria-label={t.shell.openMenu} onPress={() => setMenuOpen(true)}>
            <MenuIcon />
          </Button>
          <Link href="/admin/attekintes" className="flex flex-col leading-none">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">CUPRÉ</span>
            <span className="text-lg font-semibold">Admin</span>
          </Link>
          {current ? <span className="hidden truncate text-foreground/60 sm:inline">/ {t.shell.pages[current.key]}</span> : null}
          <span className="flex-1" />
          {user ? <span className="truncate text-sm text-foreground/60">{user}</span> : null}
        </div>
      </header>
      <Drawer.Root isOpen={menuOpen} onOpenChange={setMenuOpen}>
        <Drawer.Backdrop>
          <Drawer.Content placement="left" className="w-72 max-w-[85vw]">
            <Drawer.Dialog aria-label={t.shell.menu} className="flex h-full flex-col">
              <Drawer.Header className="flex items-center justify-between gap-2">
                <Drawer.Heading className="flex flex-col leading-none">
                  <span className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">CUPRÉ</span>
                  <span className="text-lg font-semibold">Admin</span>
                </Drawer.Heading>
                <Drawer.CloseTrigger aria-label={t.shell.closeMenu} />
              </Drawer.Header>
              <Drawer.Body>
                <nav className="flex flex-col gap-1" aria-label={t.shell.menu}>
                  {PAGES.map((page) => (
                    <Link
                      key={page.href}
                      href={page.href}
                      aria-current={pathname === page.href ? "page" : undefined}
                      className={`${buttonVariants({ variant: pathname === page.href ? "primary" : "ghost" })} w-full justify-start ${page.key === "audit" ? "mt-3" : ""}`}
                      onClick={() => setMenuOpen(false)}
                    >
                      {t.shell.pages[page.key]}
                    </Link>
                  ))}
                </nav>
              </Drawer.Body>
              <Drawer.Footer className="flex flex-col items-stretch gap-2">
                {user ? <p className="truncate text-center text-sm text-foreground/60">{user}</p> : null}
                <Button className="w-full" variant="secondary" onPress={() => void logout()}>
                  {t.shell.logout}
                </Button>
              </Drawer.Footer>
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer.Root>
      <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">{children}</main>
    </div>
  );
}
