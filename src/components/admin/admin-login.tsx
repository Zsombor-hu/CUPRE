"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Card } from "@heroui/react";
import ThemeSwitcher from "@/components/theme-switcher";

// Az admin elérhetősége és a munkamenet állapota
type Status = "loading" | "disabled" | "login";

// Admin belépő oldal: ha már van érvényes munkamenet, egyből a rendelésekre visz
export default function AdminLogin() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("loading");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Munkamenet ellenőrzése betöltéskor
  useEffect(() => {
    let active = true;
    // Állapot lekérdezése az API-tól
    async function probe() {
      const response = await fetch("/api/admin/session", { cache: "no-store" });
      const data = (await response.json()) as { configured: boolean; authenticated: boolean };
      // Már belépett: tovább a rendelésekhez
      if (data.authenticated) {
        router.replace("/admin/rendelesek");
        return;
      }
      if (active) {
        setStatus(data.configured ? "login" : "disabled");
      }
    }
    void probe();
    return () => {
      active = false;
    };
  }, [router]);

  // Belépés
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    // Sikertelen belépés: túl sok próbálkozás vagy hibás jelszó
    if (!response.ok) {
      setError(response.status === 429 ? "Túl sok próbálkozás, várj néhány percet." : "Hibás jelszó.");
      setBusy(false);
      return;
    }
    router.replace("/admin/rendelesek");
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-gradient-to-br from-accent/10 via-background to-background p-6">
      <div className="absolute right-4 top-4">
        <ThemeSwitcher />
      </div>
      <Card className="w-full max-w-sm">
        <Card.Header>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-accent">CUPRÉ</p>
          <Card.Title className="text-2xl">Admin belépés</Card.Title>
          <Card.Description>Rendelések, kuponok és hírlevél-feliratkozók kezelése.</Card.Description>
        </Card.Header>
        <Card.Content>
          {status === "loading" ? <p className="text-sm text-foreground/60">Betöltés…</p> : null}
          {status === "disabled" ? (
            <p className="text-sm">
              Az admin felület nincs bekapcsolva. Állítsd be az <code>ADMIN_PASSWORD</code> környezeti változót (legalább
              12 karakter) a környezet .env fájljában, majd indítsd újra a szervert.
            </p>
          ) : null}
          {status === "login" ? (
            <form className="flex flex-col gap-3" onSubmit={submit}>
              <label className="flex flex-col gap-1 text-sm">
                Admin jelszó
                <input
                  className="rounded-xl border border-foreground/20 bg-transparent px-3 py-2 outline-none focus:border-accent"
                  type="password"
                  autoComplete="current-password"
                  autoFocus
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </label>
              {error ? (
                <p className="text-sm text-danger" role="alert">
                  {error}
                </p>
              ) : null}
              <Button type="submit" isDisabled={busy}>
                Belépés
              </Button>
            </form>
          ) : null}
        </Card.Content>
      </Card>
    </main>
  );
}
