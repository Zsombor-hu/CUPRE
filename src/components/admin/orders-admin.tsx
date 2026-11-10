"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, buttonVariants } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import { ORDER_STATUSES, type AdminOrderDetail, type AdminOrderListItem, type OrderStatus } from "@/types/admin-order";

// Rendelésállapotok magyar felirata
const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Beérkezett",
  processing: "Feldolgozás alatt",
  shipped: "Feladva",
  completed: "Teljesítve",
  canceled: "Lemondva",
};

// Fizetési módok és állapotok magyar felirata
const PAYMENT_METHODS: Record<string, string> = { card: "Bankkártya", transfer: "Átutalás", cod: "Utánvét", none: "–" };
const PAYMENT_STATUSES: Record<string, string> = {
  not_required: "nincs teendő",
  pending: "folyamatban",
  awaiting_transfer: "átutalásra vár",
  awaiting_cod: "átvételkor fizet",
  paid: "fizetve",
  failed: "sikertelen",
  canceled: "megszakítva",
  expired: "lejárt",
};

// Szállítási módok magyar felirata
const SHIPPING_METHODS: Record<string, string> = {
  home: "Házhozszállítás",
  foxpost: "Foxpost automata",
  mpl_point: "MPL PostaPont",
  none: "–",
};

// Lista API válasza
type ListResponse = { counts: Record<OrderStatus, number>; orders: AdminOrderListItem[] };

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; data: ListResponse };

// Forint formázása
function huf(value: number): string {
  return `${value.toLocaleString("hu-HU")} Ft`;
}

// SQLite UTC időbélyeg helyi megjelenítése
function when(value: string | null): string {
  // Hiányzó időpont
  if (!value) {
    return "–";
  }
  const date = new Date(/^\d{4}-\d{2}-\d{2} /.test(value) ? `${value.replace(" ", "T")}Z` : value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("hu-HU");
}

// Egy rendelés részletei: vásárló, tételek, szállítás, fizetés, állapotváltás, napló
function OrderDetailPanel({ id, onChanged, onClose }: { id: number; onChanged: () => void; onClose: () => void }) {
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [status, setStatus] = useState<OrderStatus>("new");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);

  // Részletek betöltése
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders?id=${id}`, { cache: "no-store" });
    // Sikertelen betöltésnél a panel üres marad
    if (!response.ok) {
      return;
    }
    const data = (await response.json()) as { order: AdminOrderDetail };
    setOrder(data.order);
    setStatus(data.order.status);
  }, [id]);

  // Betöltés a kiválasztott rendelés változásakor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a részletek csak a kliensen, az admin süti alapján kérdezhetők le
    void load();
  }, [load]);

  // Állapot mentése (feladva állapotnál a vásárló levelet kap; a megjegyzés pl. csomagkövetési szám)
  async function saveStatus() {
    const response = await fetch(`/api/admin/orders?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, note }),
    });
    setMessage(response.ok ? "Állapot mentve." : "Nem sikerült menteni.");
    setNote("");
    await load();
    onChanged();
  }

  // Átutalás / utánvét beérkezésének rögzítése
  async function markPaid() {
    // Mégsem
    if (!window.confirm("Rögzíted, hogy a fizetés beérkezett? A vásárló értesítő levelet kap.")) {
      return;
    }
    const response = await fetch(`/api/admin/orders?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "markPaid" }),
    });
    setMessage(response.ok ? "Fizetés rögzítve." : "Ennél a rendelésnél nem rögzíthető.");
    await load();
    onChanged();
  }

  // Betöltés közben
  if (!order) {
    return <Card className="p-4">Betöltés…</Card>;
  }

  const canMarkPaid =
    (order.paymentMethod === "transfer" || order.paymentMethod === "cod") &&
    (order.paymentStatus === "awaiting_transfer" || order.paymentStatus === "awaiting_cod");
  return (
    <Card>
      <Card.Header>
        <div className="flex items-start justify-between gap-3">
          <div>
            <Card.Title>
              #{order.id} · {huf(order.totalHuf)}
            </Card.Title>
            <Card.Description>
              {when(order.createdAt)} · nyelv: {order.lang.toUpperCase()} · {order.accountId ? "regisztrált vásárló" : "vendég"}
            </Card.Description>
          </div>
          <button type="button" className="text-sm underline" onClick={onClose}>
            Bezárás
          </button>
        </div>
      </Card.Header>
      <Card.Content className="grid gap-4 text-sm md:grid-cols-2">
        <section>
          <h3 className="font-semibold">Vásárló</h3>
          <p>
            {order.name}
            <br />
            {order.email} · {order.phone}
            <br />
            {order.postcode} {order.city}, {order.address}
          </p>
          {order.note ? <p className="mt-2 italic">„{order.note}”</p> : null}
        </section>
        <section>
          <h3 className="font-semibold">Szállítás és fizetés</h3>
          <p>
            {SHIPPING_METHODS[order.shippingMethod]} · {huf(order.shippingFeeHuf)}
            {order.pickupPoint ? (
              <>
                <br />
                Átvételi pont: {order.pickupPoint.name}, {order.pickupPoint.address}
                {order.pickupPoint.id ? ` (${order.pickupPoint.id})` : ""}
              </>
            ) : null}
            <br />
            {PAYMENT_METHODS[order.paymentMethod]} – {PAYMENT_STATUSES[order.paymentStatus]}
            {order.paymentFeeHuf > 0 ? ` · utánvételi díj ${huf(order.paymentFeeHuf)}` : ""}
            {order.paidAt ? ` · fizetve: ${when(order.paidAt)}` : ""}
            {order.paymentRef ? (
              <>
                <br />
                Fizetési azonosító: {order.paymentRef}
              </>
            ) : null}
            {order.couponCode ? (
              <>
                <br />
                Kupon: {order.couponCode} (−{huf(order.discountHuf)})
              </>
            ) : null}
          </p>
          {canMarkPaid ? (
            <Button className="mt-2" size="sm" onPress={() => void markPaid()}>
              Fizetés beérkezett
            </Button>
          ) : null}
        </section>
        <section className="md:col-span-2">
          <h3 className="font-semibold">Tételek</h3>
          <ul className="list-disc pl-5">
            {order.items.map((item) => (
              <li key={`${item.sku}-${item.size}`}>
                {item.productName} · {item.size} · {item.grade === "first" ? "I. osztály" : "II. osztály"} · {item.qty} db ×{" "}
                {huf(item.unitPriceHuf)} ({item.sku})
              </li>
            ))}
          </ul>
        </section>
        <section className="md:col-span-2">
          <h3 className="font-semibold">Rendelésállapot</h3>
          <div className="mt-1 flex flex-wrap items-end gap-2">
            <select
              className="rounded-lg border border-foreground/20 bg-transparent px-3 py-2"
              value={status}
              onChange={(event) => setStatus(event.target.value as OrderStatus)}
            >
              {ORDER_STATUSES.map((option) => (
                <option key={option} value={option}>
                  {STATUS_LABELS[option]}
                </option>
              ))}
            </select>
            <input
              className="min-w-64 flex-1 rounded-lg border border-foreground/20 bg-transparent px-3 py-2"
              placeholder="Megjegyzés (pl. csomagkövetési szám – feladáskor a vásárló levelében is megjelenik)"
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
            <Button size="sm" onPress={() => void saveStatus()}>
              Mentés
            </Button>
          </div>
          {message ? <p className="mt-2 text-foreground/70">{message}</p> : null}
          <ul className="mt-3 text-foreground/70">
            <li>{when(order.createdAt)} – Beérkezett</li>
            {order.history.map((entry, index) => (
              <li key={`${entry.createdAt}-${index}`}>
                {when(entry.createdAt)} – {STATUS_LABELS[entry.status as OrderStatus] ?? entry.status}
                {entry.note ? ` (${entry.note})` : ""}
              </li>
            ))}
            {order.paymentEvents.map((event, index) => (
              <li key={`p-${event.createdAt}-${index}`}>
                {when(event.createdAt)} – fizetés ({event.provider}): {event.status}
              </li>
            ))}
          </ul>
        </section>
      </Card.Content>
    </Card>
  );
}

// Rendeléskezelő admin: állapot-fülek, keresés, lista, részletek, CSV export
export default function OrdersAdmin() {
  const [state, setState] = useState<State>({ kind: "loading" });
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(null);

  const params = new URLSearchParams();
  // Állapotszűrő
  if (status !== "all") {
    params.set("status", status);
  }
  // Keresés
  if (search) {
    params.set("q", search);
  }
  const queryString = params.toString();

  // Lista betöltése; 403: nincs ADMIN_PASSWORD, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders?${queryString}`, { cache: "no-store" });
    // Letiltott admin
    if (response.status === 403) {
      setState({ kind: "disabled" });
      return;
    }
    // Belépés szükséges
    if (!response.ok) {
      setState({ kind: "login" });
      return;
    }
    setState({ kind: "ready", data: (await response.json()) as ListResponse });
  }, [queryString]);

  // Betöltés indításkor és szűrőváltáskor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">Betöltés…</p>;
  }
  // Letiltott admin
  if (state.kind === "disabled") {
    return <p className="p-6">Az admin felület nincs bekapcsolva (ADMIN_PASSWORD).</p>;
  }
  // Belépés szükséges: vissza a /admin belépő oldalra
  if (state.kind === "login") {
    return <AdminRedirect />;
  }

  const { counts, orders } = state.data;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Rendelések</h1>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {(["all", ...ORDER_STATUSES] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`rounded-full border px-3 py-1 ${status === option ? "border-foreground font-semibold" : "border-foreground/20"}`}
            onClick={() => setStatus(option)}
          >
            {option === "all" ? `Mind (${total})` : `${STATUS_LABELS[option]} (${counts[option]})`}
          </button>
        ))}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
      >
        <input
          className="min-w-64 flex-1 rounded-lg border border-foreground/20 bg-transparent px-3 py-2 text-sm"
          placeholder="Keresés: rendelésszám, név vagy e-mail"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" size="sm">
          Keresés
        </Button>
        <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/orders/export?${queryString}`}>
          CSV letöltése
        </a>
        <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/orders/export?${queryString}&format=xlsx`}>
          Excel letöltése
        </a>
      </form>
      {selected !== null ? (
        <OrderDetailPanel id={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-foreground/10">
        <table className="w-full text-left text-sm">
          <thead className="bg-foreground/5">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Dátum</th>
              <th className="px-3 py-2">Vásárló</th>
              <th className="px-3 py-2">Végösszeg</th>
              <th className="px-3 py-2">Szállítás</th>
              <th className="px-3 py-2">Fizetés</th>
              <th className="px-3 py-2">Állapot</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-foreground/60" colSpan={7}>
                  Nincs találat.
                </td>
              </tr>
            ) : null}
            {orders.map((order) => (
              <tr
                key={order.id}
                className={`cursor-pointer border-t border-foreground/10 hover:bg-foreground/5 ${selected === order.id ? "bg-foreground/10" : ""}`}
                onClick={() => setSelected(order.id)}
              >
                <td className="px-3 py-2 font-semibold">{order.id}</td>
                <td className="px-3 py-2">{when(order.createdAt)}</td>
                <td className="px-3 py-2">
                  {order.name}
                  <br />
                  <span className="text-foreground/60">{order.email}</span>
                </td>
                <td className="px-3 py-2">
                  {huf(order.totalHuf)}
                  {order.couponCode ? <span className="text-foreground/60"> · {order.couponCode}</span> : null}
                </td>
                <td className="px-3 py-2">{SHIPPING_METHODS[order.shippingMethod]}</td>
                <td className="px-3 py-2">
                  {PAYMENT_METHODS[order.paymentMethod]}
                  <br />
                  <span className="text-foreground/60">{PAYMENT_STATUSES[order.paymentStatus]}</span>
                </td>
                <td className="px-3 py-2">{STATUS_LABELS[order.status] ?? order.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
