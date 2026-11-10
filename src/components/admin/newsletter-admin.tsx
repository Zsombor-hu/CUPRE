"use client";

import { useCallback, useEffect, useState } from "react";
import AdminNav from "@/components/admin/admin-nav";
import { Button, Card } from "@heroui/react";
import type { NewsletterStatus, NewsletterSubscriber } from "@/types/account";

// A lista API válasza
type ListResponse = {
  counts: Record<NewsletterStatus, number>;
  subscribers: NewsletterSubscriber[];
};

// Betöltési állapot: betöltés, letiltott admin, belépés szükséges, vagy betöltött lista
type AdminState = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; data: ListResponse };

// Állapotok magyar felirata
const STATUS_LABELS: Record<NewsletterStatus, string> = {
  active: "Aktív",
  pending: "Megerősítésre vár",
  unsubscribed: "Leiratkozott",
};

// Forrás magyar felirata
const SOURCE_LABELS: Record<string, string> = {
  form: "Hírlevél űrlap",
  checkout: "Pénztár",
  account: "Fiók",
};

// Dátum rövid megjelenítése (az SQLite UTC időt helyi időként mutatjuk)
function shortDate(value: string | null): string {
  // Hiányzó dátum
  if (!value) {
    return "–";
  }
  const date = new Date(`${value.replace(" ", "T")}Z`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("hu-HU");
}

// Admin belépő űrlap (ADMIN_PASSWORD)
function AdminLogin({ onSuccess }: { onSuccess: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Belépés
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    // Sikertelen belépés: túl sok próbálkozás vagy hibás jelszó
    if (!response.ok) {
      setError(response.status === 429 ? "Túl sok próbálkozás, várj néhány percet." : "Hibás jelszó.");
      return;
    }
    onSuccess();
  }

  return (
    <Card className="w-full max-w-sm">
      <Card.Header>
        <Card.Title>CUPRÉ admin</Card.Title>
        <Card.Description>Hírlevél-feliratkozók kezelése</Card.Description>
      </Card.Header>
      <Card.Content>
        <form className="flex flex-col gap-3" onSubmit={submit}>
          <label className="flex flex-col gap-1 text-sm">
            Admin jelszó
            <input
              className="rounded-lg border border-foreground/20 bg-transparent px-3 py-2"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <Button type="submit">Belépés</Button>
        </form>
      </Card.Content>
    </Card>
  );
}

// Hírlevél admin: számlálók, szűrés, lista, törlés, CSV export
export default function NewsletterAdmin() {
  const [state, setState] = useState<AdminState>({ kind: "loading" });
  const [filter, setFilter] = useState<NewsletterStatus | "all">("all");

  // Lista betöltése az aktuális szűrővel
  const load = useCallback(async () => {
    const query = filter === "all" ? "" : `?status=${filter}`;
    const response = await fetch(`/api/admin/newsletter${query}`, { cache: "no-store" });
    // 403: nincs ADMIN_PASSWORD beállítva; 401: belépés szükséges
    if (response.status === 403) {
      setState({ kind: "disabled" });
      return;
    }
    // Admin munkamenet nélkül a belépő űrlap jelenik meg
    if (!response.ok) {
      setState({ kind: "login" });
      return;
    }
    setState({ kind: "ready", data: (await response.json()) as ListResponse });
  }, [filter]);

  // Betöltés indításkor és szűrőváltáskor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Feliratkozó végleges törlése megerősítés után
  async function remove(subscriber: NewsletterSubscriber) {
    // Mégsem
    if (!window.confirm(`Véglegesen törlöd: ${subscriber.email}?`)) {
      return;
    }
    await fetch(`/api/admin/newsletter?id=${subscriber.id}`, { method: "DELETE" });
    await load();
  }

  // Kilépés
  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setState({ kind: "login" });
  }

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">Betöltés…</p>;
  }
  // Letiltott admin felület
  if (state.kind === "disabled") {
    return (
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>Az admin felület nincs bekapcsolva</Card.Title>
          <Card.Description>
            Állítsd be az ADMIN_PASSWORD környezeti változót (legalább 12 karakter) a környezet .env fájljában, majd
            indítsd újra a szervert.
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }
  // Belépés szükséges
  if (state.kind === "login") {
    return <AdminLogin onSuccess={() => void load()} />;
  }

  const { counts, subscribers } = state.data;
  const exportStatus = filter === "all" ? "all" : filter;
  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Hírlevél-feliratkozók</h1>
        <AdminNav />
        <div className="flex gap-2">
          <a
            className="rounded-lg border border-foreground/20 px-4 py-2 text-sm"
            href={`/api/admin/newsletter/export?status=${exportStatus}`}
          >
            CSV letöltése ({filter === "all" ? "mind" : STATUS_LABELS[filter].toLowerCase()})
          </a>
          <Button variant="secondary" onPress={() => void logout()}>
            Kilépés
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {(Object.keys(STATUS_LABELS) as NewsletterStatus[]).map((status) => (
          <Card key={status}>
            <Card.Header>
              <Card.Description>{STATUS_LABELS[status]}</Card.Description>
              <Card.Title className="text-3xl">{counts[status]}</Card.Title>
            </Card.Header>
          </Card>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", "active", "pending", "unsubscribed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full border px-3 py-1 ${filter === option ? "border-foreground font-semibold" : "border-foreground/20"}`}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? "Mind" : STATUS_LABELS[option]}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/60">
        Hírlevelet csak az „Aktív” (megerősített) címekre szabad küldeni. A CSV-t a hírlevélküldő szolgáltatóba
        importálhatod; az ott leiratkozottakat itt is töröld vagy jelöld.
      </p>
      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/5">
            <tr>
              <th className="px-3 py-2">E-mail</th>
              <th className="px-3 py-2">Név</th>
              <th className="px-3 py-2">Nyelv</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2">Forrás</th>
              <th className="px-3 py-2">Feliratkozott</th>
              <th className="px-3 py-2">Megerősítve</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {subscribers.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-foreground/60" colSpan={8}>
                  Nincs feliratkozó.
                </td>
              </tr>
            ) : null}
            {subscribers.map((subscriber) => (
              <tr key={subscriber.id} className="border-t border-foreground/10">
                <td className="px-3 py-2">{subscriber.email}</td>
                <td className="px-3 py-2">{subscriber.name || "–"}</td>
                <td className="px-3 py-2 uppercase">{subscriber.lang}</td>
                <td className="px-3 py-2">{STATUS_LABELS[subscriber.status]}</td>
                <td className="px-3 py-2">{SOURCE_LABELS[subscriber.source] ?? subscriber.source}</td>
                <td className="px-3 py-2">{shortDate(subscriber.consentAt)}</td>
                <td className="px-3 py-2">{shortDate(subscriber.confirmedAt)}</td>
                <td className="px-3 py-2 text-right">
                  <button type="button" className="text-red-600 underline" onClick={() => void remove(subscriber)}>
                    Törlés
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
