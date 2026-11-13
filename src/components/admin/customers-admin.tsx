"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button, Modal } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import DataGrid, { type GridColumn } from "@/components/admin/data-grid";
import { useAdminI18n, type AdminDictionary } from "@/components/admin/admin-i18n";
import { CopyButton, notify, useConfirm } from "@/components/admin/admin-feedback";
import type { AdminCustomerDetail, AdminCustomerListItem } from "@/types/admin-customer";

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; customers: AdminCustomerListItem[] };

// A vásárló fiókjának állapota szövegesen
function accountLabel(t: AdminDictionary, customer: AdminCustomerListItem): string {
  // Anonimizált ügyfél
  if (customer.anonymized) {
    return t.customers.anonymized;
  }
  // Vendég
  if (customer.accountId === null) {
    return t.customers.guest;
  }
  return customer.disabledAt ? t.customers.disabled : t.customers.registered;
}

// Vásárló részletei modal ablakban: elérhetőség (másolás, mailto/tel), fiók, rendelések, letiltás, anonimizálás
function CustomerDetailContent({ id, onChanged }: { id: number; onChanged: () => void }) {
  const { t, fmt, huf, when } = useAdminI18n();
  const confirm = useConfirm();
  const c = t.customers;
  const [customer, setCustomer] = useState<AdminCustomerDetail | null>(null);
  const [busy, setBusy] = useState(false);

  // Részletek betöltése
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/customers?id=${id}`, { cache: "no-store" });
    // Sikertelen betöltés
    if (!response.ok) {
      notify.error(t.common.genericError);
      return;
    }
    setCustomer(((await response.json()) as { customer: AdminCustomerDetail }).customer);
  }, [id, t.common.genericError]);

  // Betöltés a kiválasztott vásárló változásakor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a részletek csak a kliensen, az admin süti alapján kérdezhetők le
    void load();
  }, [load]);

  // Művelet futtatása megerősítés után
  async function act(action: "disable" | "enable" | "anonymize") {
    // Ismeretlen állapotban nincs művelet
    if (!customer) {
      return;
    }
    const invoices = customer.orders.filter((order) => order.invoiceNumber).length;
    const dialogs = {
      disable: { title: fmt(c.disableConfirmTitle, { name: customer.name }), message: c.disableConfirmText, confirmLabel: c.disable, danger: true },
      enable: { title: c.enable, message: c.enableConfirmText, confirmLabel: c.enable, danger: false },
      anonymize: {
        title: fmt(c.anonymizeConfirmTitle, { name: customer.name }),
        message: (
          <>
            <p>{c.anonymizeConfirmText}</p>
            {invoices > 0 ? <p className="mt-2 font-semibold text-warning">{fmt(c.hasInvoices, { count: invoices })}</p> : null}
          </>
        ),
        confirmLabel: c.anonymize,
        danger: true,
      },
    };
    // Mégsem
    if (!(await confirm(dialogs[action]))) {
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/admin/customers?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setBusy(false);
    // Sikertelen művelet
    if (!response.ok) {
      notify.error(t.common.genericError);
      return;
    }
    notify.success(action === "disable" ? c.disabledOk : action === "enable" ? c.enabledOk : c.anonymizedOk);
    await load();
    onChanged();
  }

  // Betöltés közben
  if (!customer) {
    return (
      <>
        <Modal.CloseTrigger aria-label={t.common.close} />
        <Modal.Body>
          <p className="text-sm text-foreground/60">{t.common.loading}</p>
        </Modal.Body>
      </>
    );
  }

  const address = [customer.postcode, customer.city].filter(Boolean).join(" ") + (customer.address ? `, ${customer.address}` : "");
  const statuses: Record<string, string> = t.orders.statuses;
  return (
    <>
      <Modal.CloseTrigger aria-label={t.common.close} />
      <Modal.Header className="flex flex-col items-start gap-1 pr-10">
        <Modal.Heading>{customer.name}</Modal.Heading>
        <p className="text-sm text-foreground/60">
          {accountLabel(t, customer)} · {fmt(c.since, { date: when(customer.createdAt) })}
          {customer.lastLoginAt ? ` · ${fmt(c.lastLogin, { date: when(customer.lastLoginAt) })}` : ""}
        </p>
      </Modal.Header>
      <Modal.Body className="flex flex-col gap-4 text-sm">
        {!customer.anonymized ? (
          <section className="flex flex-col gap-1">
            <span className="flex items-center gap-1">
              <a className="text-accent underline-offset-2 hover:underline" href={`mailto:${customer.email}`}>
                {customer.email}
              </a>
              <CopyButton value={customer.email} label={t.orders.detail.copyLabels.email} />
            </span>
            {customer.phone ? (
              <span className="flex items-center gap-1">
                <a className="text-accent underline-offset-2 hover:underline" href={`tel:${customer.phone.replace(/\s/g, "")}`}>
                  {customer.phone}
                </a>
                <CopyButton value={customer.phone} label={t.orders.detail.copyLabels.phone} />
              </span>
            ) : null}
            {address ? (
              <span className="flex items-center gap-1">
                {address}
                <CopyButton value={address} label={t.orders.detail.copyLabels.address} />
              </span>
            ) : null}
            {customer.newsletter ? (
              <span className="text-foreground/60">
                {fmt(c.newsletter, { status: (t.newsletter.statuses as Record<string, string>)[customer.newsletter] ?? customer.newsletter })}
              </span>
            ) : null}
          </section>
        ) : null}
        <section>
          <h3 className="mb-1 font-semibold">
            {c.ordersTitle} · {fmt(c.totalSpent, { total: huf(customer.totalSpentHuf) })}
          </h3>
          {customer.orders.length === 0 ? <p className="text-foreground/60">{c.noOrders}</p> : null}
          <ul className="-mx-2 flex flex-col">
            {customer.orders.map((order) => (
              <li key={order.id}>
                <Link className="flex justify-between gap-2 rounded-lg px-2 py-1 hover:bg-foreground/5" href={`/admin/rendelesek?id=${order.id}`}>
                  <span>
                    <span className="font-semibold">#{order.id}</span> · {when(order.createdAt)} · {statuses[order.status] ?? order.status}
                    {order.invoiceNumber ? <span className="text-foreground/60"> · {order.invoiceNumber}</span> : null}
                  </span>
                  <span className="tabular-nums">{huf(order.totalHuf)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
        {!customer.anonymized ? (
          <section className="flex flex-wrap gap-2 border-t border-foreground/10 pt-3">
            {customer.accountId !== null ? (
              <Button size="sm" variant={customer.disabledAt ? "secondary" : "danger-soft"} isDisabled={busy} onPress={() => void act(customer.disabledAt ? "enable" : "disable")}>
                {customer.disabledAt ? c.enable : c.disable}
              </Button>
            ) : null}
            <Button size="sm" variant="danger" isDisabled={busy} onPress={() => void act("anonymize")}>
              {c.anonymize}
            </Button>
          </section>
        ) : null}
      </Modal.Body>
    </>
  );
}

// Vásárlók: keresés, lista rendelési összesítővel, részletek modalban (?id= paraméterrel közvetlenül nyitható)
export default function CustomersAdmin() {
  const { t, fmt, huf, when } = useAdminI18n();
  const c = t.customers;
  const searchParams = useSearchParams();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number | null>(searchParams.get("id") ? Number(searchParams.get("id")) : null);

  // Lista betöltése; 403: letiltott admin, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch(`/api/admin/customers?q=${encodeURIComponent(search)}`, { cache: "no-store" });
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
    setState({ kind: "ready", customers: ((await response.json()) as { customers: AdminCustomerListItem[] }).customers });
  }, [search]);

  // Betöltés indításkor és kereséskor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">{t.common.loading}</p>;
  }
  // Letiltott admin
  if (state.kind === "disabled") {
    return <p className="p-6">{t.common.disabled}</p>;
  }
  // Belépés szükséges
  if (state.kind === "login") {
    return <AdminRedirect />;
  }

  const col = c.columns;
  // A vásárlólista oszlopai
  const columns: GridColumn<AdminCustomerListItem>[] = [
    {
      key: "name",
      label: col.customer,
      width: 250,
      sortValue: (customer) => customer.name,
      render: (customer) => (
        <>
          {customer.name}
          <br />
          <span className="text-foreground/60">{customer.anonymized ? "–" : customer.email}</span>
        </>
      ),
    },
    { key: "phone", label: col.phone, width: 140, sortValue: (customer) => customer.phone || null, render: (customer) => customer.phone || "–" },
    { key: "city", label: col.city, width: 140, sortValue: (customer) => customer.city || null, render: (customer) => customer.city || "–" },
    { key: "account", label: col.account, width: 130, sortValue: (customer) => accountLabel(t, customer), render: (customer) => accountLabel(t, customer) },
    { key: "orders", label: col.orders, width: 110, align: "right", sortValue: (customer) => customer.orderCount, render: (customer) => customer.orderCount },
    { key: "spent", label: col.spent, width: 150, align: "right", sortValue: (customer) => customer.totalSpentHuf, render: (customer) => huf(customer.totalSpentHuf) },
    { key: "lastOrder", label: col.lastOrder, width: 170, sortValue: (customer) => customer.lastOrderAt, render: (customer) => when(customer.lastOrderAt) },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <h1 className="text-2xl font-semibold">{c.title}</h1>
      <form
        className="flex flex-wrap gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          setSearch(query.trim());
        }}
      >
        <input
          className="w-full min-w-0 rounded-lg border border-foreground/20 bg-transparent px-3 py-2 text-sm sm:w-auto sm:min-w-64 sm:flex-1"
          placeholder={c.searchPlaceholder}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <Button type="submit" size="sm">
          {c.search}
        </Button>
      </form>
      <Modal.Root
        isOpen={selected !== null}
        onOpenChange={(open) => {
          // Bezáráskor a kiválasztás törlése
          if (!open) {
            setSelected(null);
          }
        }}
      >
        <Modal.Backdrop>
          <Modal.Container size="md" scroll="inside">
            <Modal.Dialog aria-label={c.detailDialog}>
              {selected !== null ? <CustomerDetailContent key={selected} id={selected} onChanged={() => void load()} /> : null}
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal.Root>
      <DataGrid
        rows={state.customers}
        columns={columns}
        rowKey={(customer) => customer.id}
        storageKey="admin:customers"
        emptyText={c.empty}
        resetKey={search}
        onRowClick={(customer) => setSelected(customer.id)}
        selectedKey={selected}
        renderCard={(customer) => (
          <button
            type="button"
            className="w-full rounded-xl border border-foreground/10 bg-background p-3 text-left text-sm active:bg-foreground/5"
            onClick={() => setSelected(customer.id)}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate font-semibold">{customer.name}</span>
              <span className="shrink-0 font-semibold">{huf(customer.totalSpentHuf)}</span>
            </div>
            <div className="truncate text-foreground/60">{customer.anonymized ? "–" : customer.email}</div>
            <div className="flex flex-wrap justify-between gap-x-2 text-foreground/60">
              <span>{accountLabel(t, customer)}</span>
              <span>{fmt(c.orderCount, { count: customer.orderCount })}</span>
            </div>
          </button>
        )}
      />
    </div>
  );
}
