"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Modal, buttonVariants } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import DataGrid, { type GridColumn } from "@/components/admin/data-grid";
import { useAdminI18n, type AdminDictionary } from "@/components/admin/admin-i18n";
import { CopyButton, notify, useConfirm } from "@/components/admin/admin-feedback";
import { auditActionLabel, auditDetails } from "@/components/admin/audit-text";
import {
  NEXT_ORDER_STATUS,
  ORDER_STATUSES,
  type AdminOrderDetail,
  type AdminOrderListItem,
  type OrderStatus,
} from "@/types/admin-order";

// Lista API válasza
type ListResponse = { counts: Record<OrderStatus, number>; orders: AdminOrderListItem[] };

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; data: ListResponse };

// Közös beviteli mező osztály
const INPUT = "w-full min-w-0 rounded-lg border border-foreground/20 bg-transparent px-3 py-2";

// Kódhoz tartozó felirat a szótár egy csoportjából; ismeretlen kódnál maga a kód
function label(group: Record<string, string>, code: string): string {
  return group[code] ?? code;
}

// Rendelésállapot felirata
function statusLabel(t: AdminDictionary, status: string): string {
  return label(t.orders.statuses, status);
}

// A „Következő lépés” gomb felirata a célállapot szerint
function nextStepLabel(t: AdminDictionary, next: OrderStatus): string {
  return label(t.orders.nextStep, next);
}

// Rendelés módosítása (PATCH); a válasz JSON-ja és az, hogy sikerült-e
async function patchOrder(id: number, body: Record<string, unknown>): Promise<{ ok: boolean; data: Record<string, unknown> }> {
  const response = await fetch(`/api/admin/orders?id=${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = ((await response.json().catch(() => ({}))) ?? {}) as Record<string, unknown>;
  return { ok: response.ok, data };
}

// Elérhetőség sor: link (mailto/tel) és másolás gomb
function ContactLine({ href, value, copyLabel }: { href?: string; value: string; copyLabel: string }) {
  // Üres adatnál nincs mit mutatni
  if (!value) {
    return null;
  }
  return (
    <span className="flex min-w-0 items-center gap-1">
      {href ? (
        <a className="min-w-0 truncate text-accent underline-offset-2 hover:underline" href={href}>
          {value}
        </a>
      ) : (
        <span className="min-w-0 break-words">{value}</span>
      )}
      <CopyButton value={value} label={copyLabel} />
    </span>
  );
}

// Szakasz címmel
function Section({ title, children, wide = false }: { title: string; children: React.ReactNode; wide?: boolean }) {
  return (
    <section className={`min-w-0 break-words rounded-xl border border-foreground/10 p-3 ${wide ? "md:col-span-2" : ""}`}>
      <h3 className="mb-1 font-semibold">{title}</h3>
      {children}
    </section>
  );
}

// Egy rendelés részletei modal ablakban (a tartalom rendelésenként újra betöltődik)
function OrderDetailModal({ id, onChanged, onClose }: { id: number | null; onChanged: () => void; onClose: () => void }) {
  const { t } = useAdminI18n();
  return (
    <Modal.Root
      isOpen={id !== null}
      onOpenChange={(open) => {
        // Bezáráskor a kiválasztás törlése
        if (!open) {
          onClose();
        }
      }}
    >
      <Modal.Backdrop>
        <Modal.Container size="lg" scroll="inside">
          <Modal.Dialog aria-label={t.orders.detail.dialog}>
            {id !== null ? <OrderDetailContent key={id} id={id} onChanged={onChanged} /> : null}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

// A rendelés-modal tartalma: vásárló, szállítás és fizetés, csomagkövetés, számla, tételek, belső megjegyzés,
// állapotváltás („Következő lépés”), idővonal
function OrderDetailContent({ id, onChanged }: { id: number; onChanged: () => void }) {
  const { t, fmt, huf, when } = useAdminI18n();
  const confirm = useConfirm();
  const d = t.orders.detail;
  const [order, setOrder] = useState<AdminOrderDetail | null>(null);
  const [invoicing, setInvoicing] = useState(false);
  const [status, setStatus] = useState<OrderStatus>("new");
  const [note, setNote] = useState("");
  const [tracking, setTracking] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [invoiceInput, setInvoiceInput] = useState("");
  const [busy, setBusy] = useState(false);

  // Részletek betöltése
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/orders?id=${id}`, { cache: "no-store" });
    // Sikertelen betöltésnél a panel üres marad
    if (!response.ok) {
      notify.error(t.common.genericError);
      return;
    }
    const data = (await response.json()) as { order: AdminOrderDetail; invoicing: boolean };
    setOrder(data.order);
    setInvoicing(data.invoicing);
    setStatus(data.order.status);
    setTracking(data.order.trackingNumber ?? "");
    setInternalNote(data.order.internalNote);
  }, [id, t.common.genericError]);

  // Betöltés a kiválasztott rendelés változásakor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a részletek csak a kliensen, az admin süti alapján kérdezhetők le
    void load();
  }, [load]);

  // Egy módosítás futtatása: foglaltság jelzése, eredmény toastban, újratöltés
  async function run(body: Record<string, unknown>, success: string, failure: string = d.saveFailed) {
    setBusy(true);
    const result = await patchOrder(id, body);
    setBusy(false);
    // Sikertelen művelet
    if (!result.ok) {
      notify.error(failure);
      return false;
    }
    notify.success(success);
    await load();
    onChanged();
    return true;
  }

  // Állapotváltás (lemondáshoz megerősítés kell)
  async function changeStatus(target: OrderStatus) {
    // Lemondás: a készlet visszakerül, ezért megerősítjük
    if (target === "canceled") {
      const ok = await confirm({ title: fmt(d.cancelConfirmTitle, { id }), message: d.cancelConfirmText, confirmLabel: d.cancelConfirm, danger: true });
      // Mégsem
      if (!ok) {
        return;
      }
    }
    // Sikeres váltás után a megjegyzés mező kiürül
    if (await run({ status: target, note, tracking }, fmt(d.statusChanged, { status: statusLabel(t, target) }))) {
      setNote("");
    }
  }

  // Átutalás / utánvét beérkezésének rögzítése
  async function markPaid() {
    const ok = await confirm({ title: d.markPaid, message: d.markPaidConfirm, confirmLabel: d.markPaid });
    // Mégsem
    if (!ok) {
      return;
    }
    await run({ action: "markPaid" }, d.markPaidOk, d.markPaidFailed);
  }

  // Számla kiállítása a Számlázz.hu-val
  async function issueInvoice() {
    const ok = await confirm({ title: fmt(d.invoiceIssueConfirm, { id }), message: d.invoiceIssueText, confirmLabel: d.invoiceIssue });
    // Mégsem
    if (!ok) {
      return;
    }
    setBusy(true);
    const result = await patchOrder(id, { action: "issueInvoice" });
    setBusy(false);
    // Hiba: a hibakód fordítása, szolgáltatói hibánál az üzenettel
    if (!result.ok) {
      const errors: Record<string, string> = d.invoiceErrors;
      const code = String(result.data.error ?? "");
      notify.error(fmt(errors[code] ?? t.common.genericError, { message: String(result.data.message ?? "") }));
      return;
    }
    notify.success(fmt(d.invoiceIssued, { number: String(result.data.invoiceNumber ?? "") }));
    await load();
    onChanged();
  }

  // Máshol kiállított számla számának rögzítése (üres: törlés megerősítéssel)
  async function saveInvoiceNumber(value: string) {
    // Törlés előtt megerősítés
    if (!value) {
      const ok = await confirm({ title: d.invoiceClear, message: d.invoiceClearText, confirmLabel: d.invoiceClear, danger: true });
      // Mégsem
      if (!ok) {
        return;
      }
    }
    setBusy(true);
    const result = await patchOrder(id, { action: "setInvoice", invoiceNumber: value });
    setBusy(false);
    // Hibás szám
    if (!result.ok) {
      const errors: Record<string, string> = d.invoiceErrors;
      notify.error(errors[String(result.data.error ?? "")] ?? t.common.genericError);
      return;
    }
    notify.success(value ? fmt(d.invoiceIssued, { number: value }) : d.invoiceCleared);
    setInvoiceInput("");
    await load();
    onChanged();
  }

  // Betöltés közben
  if (!order) {
    return (
      <>
        <Modal.CloseTrigger aria-label={t.common.close} />
        <Modal.Header>
          <Modal.Heading>#{id}</Modal.Heading>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm text-foreground/60">{t.common.loading}</p>
        </Modal.Body>
      </>
    );
  }

  const canMarkPaid =
    (order.paymentMethod === "transfer" || order.paymentMethod === "cod") &&
    (order.paymentStatus === "awaiting_transfer" || order.paymentStatus === "awaiting_cod");
  const next = NEXT_ORDER_STATUS[order.status];
  const fullAddress = [order.postcode, order.city].filter(Boolean).join(" ") + (order.address ? `, ${order.address}` : "");
  const c = d.copyLabels;
  // Az idővonal: beérkezés, állapotváltások, fizetési események és admin műveletek időrendben
  const timeline: { key: string; at: string; text: string; admin: string | null }[] = [
    { key: "created", at: order.createdAt, text: d.received, admin: null },
    ...order.history.map((entry, index) => ({
      key: `h-${index}`,
      at: entry.createdAt,
      text: `${statusLabel(t, entry.status)}${entry.note ? ` (${entry.note})` : ""}`,
      admin: entry.adminName,
    })),
    ...order.paymentEvents.map((event, index) => ({
      key: `p-${index}`,
      at: event.createdAt,
      text: fmt(d.paymentEvent, { provider: event.provider, status: event.status }),
      admin: null,
    })),
    ...order.activity.map((entry) => {
      const details = auditDetails(t, entry);
      return { key: `a-${entry.id}`, at: entry.createdAt, text: `${auditActionLabel(t, entry)}${details ? `: ${details}` : ""}`, admin: entry.adminName };
    }),
  ].sort((a, b) => a.at.localeCompare(b.at));
  return (
    <>
      <Modal.CloseTrigger aria-label={t.common.close} />
      <Modal.Header className="flex flex-col items-start gap-1 pr-10">
        <Modal.Heading>
          #{order.id} · {huf(order.totalHuf)} · {statusLabel(t, order.status)}
        </Modal.Heading>
        <p className="text-sm text-foreground/60">
          {fmt(d.meta, {
            date: when(order.createdAt),
            lang: order.lang.toUpperCase(),
            customerType: order.accountId ? d.registered : d.guest,
          })}
        </p>
      </Modal.Header>
      <Modal.Body className="grid gap-3 text-sm md:grid-cols-2">
        <Section title={d.customer}>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{order.name}</span>
            <ContactLine href={`mailto:${order.email}`} value={order.email} copyLabel={c.email} />
            <ContactLine href={order.phone ? `tel:${order.phone.replace(/\s/g, "")}` : undefined} value={order.phone} copyLabel={c.phone} />
            <ContactLine value={fullAddress} copyLabel={c.address} />
          </div>
          {order.note ? <p className="mt-2 italic">„{order.note}”</p> : null}
          <Link className="mt-2 inline-block text-accent underline-offset-2 hover:underline" href={`/admin/vasarlok?id=${order.customerId}`}>
            {d.customerLink} →
          </Link>
        </Section>

        <Section title={d.shippingPayment}>
          <p>
            {label(t.orders.shippingMethods, order.shippingMethod)} · {huf(order.shippingFeeHuf)}
            {order.pickupPoint ? (
              <>
                <br />
                {d.pickupPoint} {order.pickupPoint.name}, {order.pickupPoint.address}
                {order.pickupPoint.id ? ` (${order.pickupPoint.id})` : ""}
              </>
            ) : null}
            <br />
            {label(t.orders.paymentMethods, order.paymentMethod)} – {label(t.orders.paymentStatuses, order.paymentStatus)}
            {order.paymentFeeHuf > 0 ? ` · ${fmt(d.codFee, { fee: huf(order.paymentFeeHuf) })}` : ""}
            {order.paidAt ? ` · ${fmt(d.paidAt, { date: when(order.paidAt) })}` : ""}
            {order.paymentRef ? (
              <>
                <br />
                {d.paymentRef} {order.paymentRef}
              </>
            ) : null}
            {order.couponCode ? (
              <>
                <br />
                {d.coupon} {order.couponCode} (−{huf(order.discountHuf)})
              </>
            ) : null}
          </p>
          {canMarkPaid ? (
            <Button className="mt-2" size="sm" isDisabled={busy} onPress={() => void markPaid()}>
              {d.markPaid}
            </Button>
          ) : null}
        </Section>

        <Section title={d.tracking}>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              void run({ action: "tracking", tracking }, d.trackingSaved);
            }}
          >
            <input className={`${INPUT} flex-1`} placeholder={d.trackingPlaceholder} value={tracking} onChange={(event) => setTracking(event.target.value)} />
            <Button type="submit" size="sm" variant="secondary" isDisabled={busy || tracking === (order.trackingNumber ?? "")}>
              {t.common.save}
            </Button>
          </form>
          {order.trackingNumber ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <ContactLine value={order.trackingNumber} copyLabel={c.tracking} />
              {order.trackingUrl ? (
                <a className="text-accent underline-offset-2 hover:underline" href={order.trackingUrl} target="_blank" rel="noreferrer">
                  {d.trackingOpen} ↗
                </a>
              ) : null}
            </div>
          ) : null}
        </Section>

        <Section title={d.invoice}>
          {order.invoiceNumber ? (
            <div className="flex flex-col gap-1">
              <div className="flex flex-wrap items-center gap-2">
                <ContactLine value={order.invoiceNumber} copyLabel={c.invoice} />
                <span className="text-foreground/60">{fmt(d.invoiceIssuedAt, { date: when(order.invoiceIssuedAt) })}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {order.hasInvoiceFile ? (
                  <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/orders/invoice?id=${order.id}`} target="_blank" rel="noreferrer">
                    {d.invoicePdf}
                  </a>
                ) : null}
                <Button size="sm" variant="ghost" isDisabled={busy} onPress={() => void saveInvoiceNumber("")}>
                  {d.invoiceClear}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-foreground/60">{d.invoiceNone}</p>
              {invoicing ? (
                <Button size="sm" isDisabled={busy || order.status === "canceled"} onPress={() => void issueInvoice()}>
                  {d.invoiceIssue}
                </Button>
              ) : (
                <p className="text-xs text-foreground/60">{d.invoiceNotConfigured}</p>
              )}
              <form
                className="flex flex-wrap gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  // Üres mezővel nincs mit rögzíteni
                  if (invoiceInput.trim()) {
                    void saveInvoiceNumber(invoiceInput.trim());
                  }
                }}
              >
                <input
                  className={`${INPUT} flex-1`}
                  placeholder={d.invoiceManualPlaceholder}
                  value={invoiceInput}
                  onChange={(event) => setInvoiceInput(event.target.value)}
                />
                <Button type="submit" size="sm" variant="secondary" isDisabled={busy || !invoiceInput.trim()}>
                  {d.invoiceManual}
                </Button>
              </form>
            </div>
          )}
        </Section>

        <Section title={d.items} wide>
          <ul className="list-disc pl-5">
            {order.items.map((item) => (
              <li key={`${item.sku}-${item.size}`}>
                {item.productName} · {item.size} · {item.grade === "first" ? d.firstGrade : d.secondGrade} · {fmt(d.qty, { qty: item.qty })} ×{" "}
                {huf(item.unitPriceHuf)} ({item.sku})
              </li>
            ))}
          </ul>
        </Section>

        <Section title={d.internalNote} wide>
          <p className="mb-1 text-xs text-foreground/60">{d.internalNoteHint}</p>
          <textarea
            className={`${INPUT} min-h-20`}
            value={internalNote}
            maxLength={2000}
            onChange={(event) => setInternalNote(event.target.value)}
          />
          <Button
            className="mt-2"
            size="sm"
            variant="secondary"
            isDisabled={busy || internalNote === order.internalNote}
            onPress={() => void run({ action: "internalNote", note: internalNote }, d.internalNoteSaved)}
          >
            {t.common.save}
          </Button>
        </Section>

        <Section title={d.orderStatus} wide>
          {next ? (
            <div className="flex flex-col gap-2 rounded-lg bg-accent/10 p-3">
              {next === "shipped" ? <p className="text-foreground/70">{d.shipHint}</p> : null}
              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                {next === "shipped" ? (
                  <input
                    className={`${INPUT} sm:w-auto sm:min-w-56 sm:flex-1`}
                    placeholder={d.trackingPlaceholder}
                    value={tracking}
                    onChange={(event) => setTracking(event.target.value)}
                  />
                ) : null}
                <Button className="w-full sm:w-auto" isDisabled={busy} onPress={() => void changeStatus(next)}>
                  {nextStepLabel(t, next)} →
                </Button>
              </div>
            </div>
          ) : null}
          <details className="mt-3">
            <summary className="cursor-pointer text-foreground/70">{d.otherStatus}</summary>
            <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
              <select
                className="w-full rounded-lg border border-foreground/20 bg-transparent px-3 py-2 sm:w-auto"
                value={status}
                onChange={(event) => setStatus(event.target.value as OrderStatus)}
              >
                {ORDER_STATUSES.map((option) => (
                  <option key={option} value={option}>
                    {statusLabel(t, option)}
                  </option>
                ))}
              </select>
              <input
                className={`${INPUT} sm:w-auto sm:min-w-64 sm:flex-1`}
                placeholder={d.notePlaceholder}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
              <Button className="w-full sm:w-auto" variant="secondary" isDisabled={busy || status === order.status} onPress={() => void changeStatus(status)}>
                {t.common.save}
              </Button>
            </div>
          </details>
        </Section>

        <Section title={d.activity} wide>
          <ul className="flex flex-col gap-0.5 text-foreground/70">
            {timeline.map((entry) => (
              <li key={entry.key}>
                {when(entry.at)} – {entry.text}
                {entry.admin ? <span className="text-foreground/50"> · {entry.admin}</span> : null}
              </li>
            ))}
          </ul>
        </Section>
      </Modal.Body>
    </>
  );
}

// A lista szűrői query stringként (az API-hívás, az export és a címsor közös alakja)
function filterQuery(status: OrderStatus | "all", paymentStatus: string, missingInvoice: boolean, search: string): string {
  const params = new URLSearchParams();
  // Állapotszűrő
  if (status !== "all") {
    params.set("status", status);
  }
  // Fizetési állapot szűrő (az áttekintő oldalról érkezve)
  if (paymentStatus) {
    params.set("paymentStatus", paymentStatus);
  }
  // Számla nélküli, kifizetett rendelések (az áttekintő oldalról érkezve)
  if (missingInvoice) {
    params.set("invoice", "missing");
  }
  // Keresés
  if (search) {
    params.set("q", search);
  }
  return params.toString();
}

// Rendeléskezelő admin: állapot-fülek, keresés, lista (mobilon kártyák) gyors „következő lépés” gombbal,
// részletek modalban, CSV/Excel export. Az URL ?status=, ?paymentStatus=, ?q= és ?id= paraméterei előre beállítják a nézetet.
export default function OrdersAdmin() {
  const { t, fmt, huf, when } = useAdminI18n();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status");
  const [state, setState] = useState<State>({ kind: "loading" });
  const [status, setStatus] = useState<OrderStatus | "all">(
    ORDER_STATUSES.includes(initialStatus as OrderStatus) ? (initialStatus as OrderStatus) : "all",
  );
  const [paymentStatus, setPaymentStatus] = useState(searchParams.get("paymentStatus") ?? "");
  const [missingInvoice, setMissingInvoice] = useState(searchParams.get("invoice") === "missing");
  const [query, setQuery] = useState(searchParams.get("q") ?? "");
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [selected, setSelected] = useState<number | null>(searchParams.get("id") ? Number(searchParams.get("id")) : null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const queryString = filterQuery(status, paymentStatus, missingInvoice, search);

  // A szűrők megjelenítése a címsorban is (linkelhető, frissítés után megmarad)
  useEffect(() => {
    const url = queryString ? `?${queryString}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [queryString]);

  // Lista betöltése; 403: nincs ADMIN_USER_1…5, 401: belépés szükséges
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
  }, [queryString, setState]);

  // Betöltés indításkor és szűrőváltáskor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Gyors állapotváltás a listából; a feladáshoz (követési szám) a részletek nyílnak meg
  async function quickNext(order: AdminOrderListItem) {
    const next = NEXT_ORDER_STATUS[order.status];
    // Lezárt rendelésnél nincs következő lépés
    if (!next) {
      return;
    }
    // Feladás: a követési számot a részleteknél lehet megadni
    if (next === "shipped") {
      setSelected(order.id);
      return;
    }
    setBusyId(order.id);
    const result = await patchOrder(order.id, { status: next, note: "" });
    setBusyId(null);
    // Sikertelen váltás
    if (!result.ok) {
      notify.error(t.orders.detail.saveFailed);
      return;
    }
    notify.success(fmt(t.orders.detail.statusChangedFor, { id: order.id, status: statusLabel(t, next) }));
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

  // Gyors következő lépés gomb (lista és kártya)
  const nextButton = (order: AdminOrderListItem) => {
    const next = NEXT_ORDER_STATUS[order.status];
    // Lezárt rendelés
    if (!next) {
      return <span className="text-foreground/40">–</span>;
    }
    return (
      <Button
        size="sm"
        variant={order.status === "new" ? "primary" : "secondary"}
        isDisabled={busyId === order.id}
        onPress={() => void quickNext(order)}
      >
        {nextStepLabel(t, next)}
      </Button>
    );
  };

  const c = t.orders.columns;
  // A rendeléslista oszlopai (rendezhetők, méretezhetők)
  const columns: GridColumn<AdminOrderListItem>[] = [
    { key: "id", label: "#", width: 80, sortValue: (order) => order.id, render: (order) => <span className="font-semibold">{order.id}</span> },
    { key: "createdAt", label: c.date, width: 170, sortValue: (order) => order.createdAt, render: (order) => when(order.createdAt) },
    {
      key: "name",
      label: c.customer,
      width: 230,
      sortValue: (order) => order.name,
      render: (order) => (
        <>
          {order.name}
          <br />
          <span className="text-foreground/60">{order.email}</span>
        </>
      ),
    },
    {
      key: "totalHuf",
      label: c.total,
      width: 140,
      sortValue: (order) => order.totalHuf,
      render: (order) => (
        <>
          {huf(order.totalHuf)}
          {order.couponCode ? <span className="text-foreground/60"> · {order.couponCode}</span> : null}
        </>
      ),
    },
    {
      key: "shipping",
      label: c.shipping,
      width: 170,
      sortValue: (order) => label(t.orders.shippingMethods, order.shippingMethod),
      render: (order) => (
        <>
          {label(t.orders.shippingMethods, order.shippingMethod)}
          {order.trackingNumber ? (
            <>
              <br />
              <span className="text-foreground/60">{order.trackingNumber}</span>
            </>
          ) : null}
        </>
      ),
    },
    {
      key: "payment",
      label: c.payment,
      width: 170,
      sortValue: (order) => `${label(t.orders.paymentMethods, order.paymentMethod)} ${label(t.orders.paymentStatuses, order.paymentStatus)}`,
      render: (order) => (
        <>
          {label(t.orders.paymentMethods, order.paymentMethod)}
          <br />
          <span className="text-foreground/60">{label(t.orders.paymentStatuses, order.paymentStatus)}</span>
        </>
      ),
    },
    {
      key: "invoice",
      label: c.invoice,
      width: 140,
      sortValue: (order) => order.invoiceNumber,
      render: (order) => order.invoiceNumber ?? <span className="text-foreground/40">–</span>,
    },
    { key: "status", label: c.status, width: 140, sortValue: (order) => statusLabel(t, order.status), render: (order) => statusLabel(t, order.status) },
    {
      key: "next",
      label: c.nextStep,
      width: 170,
      render: (order) => (
        // A gomb ne nyissa meg a sor részleteit is
        <div onClick={(event) => event.stopPropagation()}>{nextButton(order)}</div>
      ),
    },
  ];

  const { counts, orders } = state.data;
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <h1 className="text-2xl font-semibold">{t.orders.title}</h1>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", ...ORDER_STATUSES] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 transition-colors ${status === option ? "border-accent bg-accent font-semibold text-accent-foreground shadow-sm" : "border-foreground/20 hover:border-accent/60 hover:bg-accent/10"}`}
            onClick={() => setStatus(option)}
          >
            {option === "all" ? fmt(t.orders.all, { count: total }) : `${statusLabel(t, option)} (${counts[option]})`}
          </button>
        ))}
        {paymentStatus ? (
          <button
            type="button"
            className="shrink-0 whitespace-nowrap rounded-full border border-accent bg-accent/10 px-3 py-1"
            title={t.orders.clearFilter}
            onClick={() => setPaymentStatus("")}
          >
            {fmt(t.orders.filterPayment, { status: label(t.orders.paymentStatuses, paymentStatus) })} ✕
          </button>
        ) : null}
        {missingInvoice ? (
          <button
            type="button"
            className="shrink-0 whitespace-nowrap rounded-full border border-accent bg-accent/10 px-3 py-1"
            title={t.orders.clearFilter}
            onClick={() => setMissingInvoice(false)}
          >
            {t.orders.filterMissingInvoice} ✕
          </button>
        ) : null}
      </div>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
      >
        <input
          className="w-full min-w-0 rounded-lg border border-foreground/20 bg-transparent px-3 py-2 text-sm sm:w-auto sm:min-w-64 sm:flex-1"
          placeholder={t.orders.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" size="sm">
          {t.orders.search}
        </Button>
        <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/orders/export?${queryString}`}>
          {t.common.csv}
        </a>
        <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/orders/export?${queryString}&format=xlsx`}>
          {t.common.excel}
        </a>
      </form>
      <OrderDetailModal id={selected} onClose={() => setSelected(null)} onChanged={() => void load()} />
      <DataGrid
        rows={orders}
        columns={columns}
        rowKey={(order) => order.id}
        storageKey="admin:orders"
        emptyText={t.orders.empty}
        defaultSort={{ key: "id", dir: "desc" }}
        resetKey={queryString}
        onRowClick={(order) => setSelected(order.id)}
        selectedKey={selected}
        renderCard={(order) => (
          <div className="w-full rounded-xl border border-foreground/10 bg-background p-3 text-left text-sm">
            <button type="button" className="w-full text-left active:opacity-70" onClick={() => setSelected(order.id)}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-semibold">#{order.id}</span>
                <span className="font-semibold">{huf(order.totalHuf)}</span>
              </div>
              <div className="truncate">{order.name}</div>
              <div className="truncate text-foreground/60">{order.email}</div>
              <div className="mt-1 flex flex-wrap justify-between gap-x-2 text-foreground/60">
                <span>{when(order.createdAt)}</span>
                <span className="text-foreground">{statusLabel(t, order.status)}</span>
              </div>
              <div className="text-foreground/60">
                {label(t.orders.shippingMethods, order.shippingMethod)} · {label(t.orders.paymentMethods, order.paymentMethod)} (
                {label(t.orders.paymentStatuses, order.paymentStatus)})
              </div>
            </button>
            {NEXT_ORDER_STATUS[order.status] ? <div className="mt-2">{nextButton(order)}</div> : null}
          </div>
        )}
      />
    </div>
  );
}
