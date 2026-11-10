"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import AdminNav from "@/components/admin/admin-nav";
import type { Coupon } from "@/types/coupon";

// Betöltési állapot: betöltés, letiltott admin, belépés szükséges, vagy betöltött lista
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; coupons: Coupon[] };

// Üres új-kupon űrlap
const EMPTY_FORM = { code: "", amountHuf: "", validFrom: "", validUntil: "", note: "" };

// Mai dátum budapesti idő szerint (ÉÉÉÉ-HH-NN) – az állapot kijelzéséhez
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
}

// Kupon aktuális állapota a lista oszlopához
function statusLabel(coupon: Coupon): string {
  const now = today();
  // Kézzel kikapcsolt kupon
  if (!coupon.active) {
    return "Kikapcsolva";
  }
  // Még nem kezdődött el
  if (coupon.validFrom && now < coupon.validFrom) {
    return "Még nem érvényes";
  }
  // Lejárt
  if (coupon.validUntil && now > coupon.validUntil) {
    return "Lejárt";
  }
  return "Érvényes";
}

// Közös beviteli mező osztály
const INPUT = "rounded-lg border border-foreground/20 bg-transparent px-3 py-2";

// Kupon admin: új fix összegű kupon létrehozása (érvényesség tól–ig), lista, be/kikapcsolás, törlés.
// Belépés és jogosultság a hírlevél adminnal közös (ADMIN_PASSWORD).
export default function CouponAdmin() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Lista betöltése; 403: nincs ADMIN_PASSWORD, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/coupons", { cache: "no-store" });
    // Letiltott admin felület
    if (response.status === 403) {
      setState({ kind: "disabled" });
      return;
    }
    // Admin munkamenet nélkül a hírlevél admin oldalon kell belépni
    if (!response.ok) {
      setState({ kind: "login" });
      return;
    }
    setState({ kind: "ready", coupons: ((await response.json()) as { coupons: Coupon[] }).coupons });
  }, []);

  // Első betöltés
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Új kupon mentése
  async function create(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const response = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, amountHuf: Number(form.amountHuf) }),
    });
    // Hibás adatok vagy foglalt kód
    if (!response.ok) {
      setError(((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "Hiba történt.");
      return;
    }
    setForm(EMPTY_FORM);
    await load();
  }

  // Kupon be/kikapcsolása (a többi adat változatlan)
  async function toggle(coupon: Coupon) {
    await fetch(`/api/admin/coupons?id=${coupon.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amountHuf: coupon.amountHuf,
        validFrom: coupon.validFrom ?? "",
        validUntil: coupon.validUntil ?? "",
        note: coupon.note,
        active: !coupon.active,
      }),
    });
    await load();
  }

  // Kupon törlése megerősítés után
  async function remove(coupon: Coupon) {
    // Mégsem
    if (!window.confirm(`Véglegesen törlöd a(z) ${coupon.code} kupont?`)) {
      return;
    }
    await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
    await load();
  }

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">Betöltés…</p>;
  }
  // Letiltott admin
  if (state.kind === "disabled") {
    return <p className="p-6">Az admin felület nincs bekapcsolva (ADMIN_PASSWORD).</p>;
  }
  // Belépés szükséges (a belépő űrlap a hírlevél admin oldalon van)
  if (state.kind === "login") {
    return (
      <Card className="w-full max-w-sm">
        <Card.Header>
          <Card.Title>Belépés szükséges</Card.Title>
          <Card.Description>
            Lépj be az admin felületre: <Link href="/admin/hirlevel" className="underline">Admin belépés</Link>
          </Card.Description>
        </Card.Header>
      </Card>
    );
  }

  return (
    <div className="flex w-full max-w-6xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Kuponok</h1>
        <AdminNav />
      </div>
      <Card>
        <Card.Header>
          <Card.Title>Új kupon</Card.Title>
          <Card.Description>
            Fix összegű kedvezmény a termékek árából (a szállítási díjat nem érinti). Az érvényesség napra pontos,
            a kezdő és a záró nap is beleszámít; üresen hagyva nincs korlát.
          </Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="grid gap-3 sm:grid-cols-5" onSubmit={create}>
            <label className="flex flex-col gap-1 text-sm">
              Kód
              <input className={`${INPUT} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Kedvezmény (Ft)
              <input className={INPUT} type="number" min={1} step={1} value={form.amountHuf} onChange={(e) => setForm({ ...form, amountHuf: e.target.value })} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Érvényes ettől
              <input className={INPUT} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Érvényes eddig
              <input className={INPUT} type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              Megjegyzés
              <input className={INPUT} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            {error ? <p className="text-sm text-red-600 sm:col-span-5">{error}</p> : null}
            <div className="sm:col-span-5">
              <Button type="submit">Kupon létrehozása</Button>
            </div>
          </form>
        </Card.Content>
      </Card>
      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/5">
            <tr>
              <th className="px-3 py-2">Kód</th>
              <th className="px-3 py-2">Kedvezmény</th>
              <th className="px-3 py-2">Érvényesség</th>
              <th className="px-3 py-2">Állapot</th>
              <th className="px-3 py-2">Felhasználva</th>
              <th className="px-3 py-2">Megjegyzés</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {state.coupons.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-foreground/60" colSpan={7}>
                  Még nincs kupon.
                </td>
              </tr>
            ) : null}
            {state.coupons.map((coupon) => (
              <tr key={coupon.id} className="border-t border-foreground/10">
                <td className="px-3 py-2 font-semibold">{coupon.code}</td>
                <td className="px-3 py-2">{coupon.amountHuf.toLocaleString("hu-HU")} Ft</td>
                <td className="px-3 py-2">
                  {coupon.validFrom ?? "–"} – {coupon.validUntil ?? "–"}
                </td>
                <td className="px-3 py-2">{statusLabel(coupon)}</td>
                <td className="px-3 py-2">{coupon.usedCount}×</td>
                <td className="px-3 py-2">{coupon.note || "–"}</td>
                <td className="flex gap-3 px-3 py-2 text-right">
                  <button type="button" className="underline" onClick={() => void toggle(coupon)}>
                    {coupon.active ? "Kikapcsolás" : "Bekapcsolás"}
                  </button>
                  <button type="button" className="text-red-600 underline" onClick={() => void remove(coupon)}>
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
