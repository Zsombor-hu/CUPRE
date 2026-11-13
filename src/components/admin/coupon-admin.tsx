"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import DataGrid, { type GridColumn } from "@/components/admin/data-grid";
import { useAdminI18n, type AdminDictionary } from "@/components/admin/admin-i18n";
import { notify, useConfirm } from "@/components/admin/admin-feedback";
import type { Coupon } from "@/types/coupon";

// Betöltési állapot: betöltés, letiltott admin, belépés szükséges, vagy betöltött lista
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; coupons: Coupon[] };

// Üres új-kupon űrlap
const EMPTY_FORM = { code: "", amountHuf: "", validFrom: "", validUntil: "", note: "" };

// Mai dátum budapesti idő szerint (ÉÉÉÉ-HH-NN) – az állapot kijelzéséhez
function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(new Date());
}

// Kupon aktuális állapota a lista oszlopához (a választott nyelven)
function statusLabel(t: AdminDictionary, coupon: Coupon): string {
  const now = today();
  // Kézzel kikapcsolt kupon
  if (!coupon.active) {
    return t.coupons.statuses.inactive;
  }
  // Még nem kezdődött el
  if (coupon.validFrom && now < coupon.validFrom) {
    return t.coupons.statuses.notYetValid;
  }
  // Lejárt
  if (coupon.validUntil && now > coupon.validUntil) {
    return t.coupons.statuses.expired;
  }
  return t.coupons.statuses.valid;
}

// Közös beviteli mező osztály
const INPUT = "rounded-lg border border-foreground/20 bg-transparent px-3 py-2";

// Kupon admin: új fix összegű kupon létrehozása (érvényesség tól–ig), lista, be/kikapcsolás, törlés.
// Belépés és jogosultság a hírlevél adminnal közös (ADMIN_USER_1…5).
export default function CouponAdmin() {
  const { t, fmt, huf } = useAdminI18n();
  const confirm = useConfirm();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState<string | null>(null);

  // Lista betöltése; 403: nincs ADMIN_USER_1…5, 401: belépés szükséges
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
      const code = ((await response.json().catch(() => null)) as { error?: string } | null)?.error ?? "";
      const errors: Record<string, string> = t.coupons.errors;
      setError(errors[code] ?? t.common.genericError);
      return;
    }
    notify.success(fmt(t.coupons.created, { code: form.code.toUpperCase() }));
    setForm(EMPTY_FORM);
    await load();
  }

  // Kupon be/kikapcsolása (a többi adat változatlan)
  async function toggle(coupon: Coupon) {
    const response = await fetch(`/api/admin/coupons?id=${coupon.id}`, {
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
    // Eredmény visszajelzése
    if (response.ok) {
      notify.success(fmt(coupon.active ? t.coupons.disabledOk : t.coupons.enabledOk, { code: coupon.code }));
    } else {
      notify.error(t.common.genericError);
    }
    await load();
  }

  // Kupon törlése megerősítés után
  async function remove(coupon: Coupon) {
    const ok = await confirm({ title: fmt(t.coupons.deleteConfirm, { code: coupon.code }), confirmLabel: t.common.delete, danger: true });
    // Mégsem
    if (!ok) {
      return;
    }
    const response = await fetch(`/api/admin/coupons?id=${coupon.id}`, { method: "DELETE" });
    // Eredmény visszajelzése
    if (response.ok) {
      notify.success(fmt(t.coupons.deleted, { code: coupon.code }));
    } else {
      notify.error(t.common.genericError);
    }
    await load();
  }

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">{t.common.loading}</p>;
  }
  // Letiltott admin
  if (state.kind === "disabled") {
    return <p className="p-6">{t.common.disabled}</p>;
  }
  // Belépés szükséges: vissza a /admin belépő oldalra
  if (state.kind === "login") {
    return <AdminRedirect />;
  }

  // A kuponlista oszlopai (a műveletek a betöltött lista kezelőit használják)
  const c = t.coupons.columns;
  const columns: GridColumn<Coupon>[] = [
    { key: "code", label: c.code, width: 150, sortValue: (coupon) => coupon.code, render: (coupon) => <span className="font-semibold">{coupon.code}</span> },
    {
      key: "amountHuf",
      label: c.amount,
      width: 130,
      sortValue: (coupon) => coupon.amountHuf,
      render: (coupon) => huf(coupon.amountHuf),
    },
    {
      key: "validity",
      label: c.validity,
      width: 220,
      sortValue: (coupon) => coupon.validFrom,
      render: (coupon) => `${coupon.validFrom ?? "–"} – ${coupon.validUntil ?? "–"}`,
    },
    { key: "status", label: c.status, width: 150, sortValue: (coupon) => statusLabel(t, coupon), render: (coupon) => statusLabel(t, coupon) },
    { key: "usedCount", label: c.used, width: 130, sortValue: (coupon) => coupon.usedCount, render: (coupon) => `${coupon.usedCount}×` },
    { key: "note", label: c.note, width: 220, sortValue: (coupon) => coupon.note || null, render: (coupon) => coupon.note || "–" },
    {
      key: "actions",
      label: "",
      width: 210,
      render: (coupon) => (
        <div className="flex gap-3">
          <button type="button" className="underline" onClick={() => void toggle(coupon)}>
            {coupon.active ? t.coupons.disable : t.coupons.enable}
          </button>
          <button type="button" className="text-red-600 underline" onClick={() => void remove(coupon)}>
            {t.common.delete}
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{t.coupons.title}</h1>
      </div>
      <Card>
        <Card.Header>
          <Card.Title>{t.coupons.newTitle}</Card.Title>
          <Card.Description>{t.coupons.newDescription}</Card.Description>
        </Card.Header>
        <Card.Content>
          <form className="grid gap-3 sm:grid-cols-5" onSubmit={create}>
            <label className="flex flex-col gap-1 text-sm">
              {t.coupons.code}
              <input className={`${INPUT} uppercase`} value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.coupons.amount}
              <input className={INPUT} type="number" min={1} step={1} value={form.amountHuf} onChange={(e) => setForm({ ...form, amountHuf: e.target.value })} required />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.coupons.validFrom}
              <input className={INPUT} type="date" value={form.validFrom} onChange={(e) => setForm({ ...form, validFrom: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.coupons.validUntil}
              <input className={INPUT} type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {t.coupons.note}
              <input className={INPUT} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
            </label>
            {error ? <p className="text-sm text-red-600 sm:col-span-5">{error}</p> : null}
            <div className="sm:col-span-5">
              <Button type="submit">{t.coupons.create}</Button>
            </div>
          </form>
        </Card.Content>
      </Card>
      <DataGrid
        rows={state.coupons}
        columns={columns}
        rowKey={(coupon) => coupon.id}
        storageKey="admin:coupons"
        emptyText={t.coupons.empty}
        renderCard={(coupon) => (
          <div className="rounded-xl border border-foreground/10 bg-background p-3 text-sm">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">{coupon.code}</span>
              <span className="font-semibold">{huf(coupon.amountHuf)}</span>
            </div>
            <div className="text-foreground/60">
              {coupon.validFrom ?? "–"} – {coupon.validUntil ?? "–"} · {statusLabel(t, coupon)} · {coupon.usedCount}×
            </div>
            {coupon.note ? <div className="break-words text-foreground/60">{coupon.note}</div> : null}
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onPress={() => void toggle(coupon)}>
                {coupon.active ? t.coupons.disable : t.coupons.enable}
              </Button>
              <Button size="sm" variant="danger" onPress={() => void remove(coupon)}>
                {t.common.delete}
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
