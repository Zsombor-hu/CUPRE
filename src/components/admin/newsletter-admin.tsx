"use client";

import { useCallback, useEffect, useState } from "react";
import AdminRedirect from "@/components/admin/admin-redirect";
import { Button, Card, buttonVariants } from "@heroui/react";
import DataGrid, { type GridColumn } from "@/components/admin/data-grid";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { notify, useConfirm } from "@/components/admin/admin-feedback";
import type { NewsletterStatus, NewsletterSubscriber } from "@/types/account";

// A lista API válasza
type ListResponse = {
  counts: Record<NewsletterStatus, number>;
  subscribers: NewsletterSubscriber[];
};

// Betöltési állapot: betöltés, letiltott admin, belépés szükséges, vagy betöltött lista
type AdminState = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; data: ListResponse };

// A feliratkozási állapotok sorrendje (számlálók és szűrőgombok)
const STATUSES: NewsletterStatus[] = ["active", "pending", "unsubscribed"];

// Hírlevél admin: számlálók, szűrés, lista, törlés, CSV export
export default function NewsletterAdmin() {
  const { t, fmt, when } = useAdminI18n();
  const confirm = useConfirm();
  const n = t.newsletter;
  const sourceLabels: Record<string, string> = n.sources;
  const [state, setState] = useState<AdminState>({ kind: "loading" });
  const [filter, setFilter] = useState<NewsletterStatus | "all">("all");

  // Lista betöltése az aktuális szűrővel
  const load = useCallback(async () => {
    const query = filter === "all" ? "" : `?status=${filter}`;
    const response = await fetch(`/api/admin/newsletter${query}`, { cache: "no-store" });
    // 403: nincs ADMIN_USER_1…5 beállítva; 401: belépés szükséges
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
    const ok = await confirm({ title: fmt(n.deleteConfirm, { email: subscriber.email }), confirmLabel: t.common.delete, danger: true });
    // Mégsem
    if (!ok) {
      return;
    }
    const response = await fetch(`/api/admin/newsletter?id=${subscriber.id}`, { method: "DELETE" });
    // Eredmény visszajelzése
    if (response.ok) {
      notify.success(fmt(n.deleted, { email: subscriber.email }));
    } else {
      notify.error(t.common.genericError);
    }
    await load();
  }

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">{t.common.loading}</p>;
  }
  // Letiltott admin felület
  if (state.kind === "disabled") {
    return (
      <Card className="w-full max-w-md">
        <Card.Header>
          <Card.Title>{n.disabledTitle}</Card.Title>
          <Card.Description>{n.disabledText}</Card.Description>
        </Card.Header>
      </Card>
    );
  }
  // Belépés szükséges
  if (state.kind === "login") {
    return <AdminRedirect />;
  }

  const { counts, subscribers } = state.data;
  const exportStatus = filter === "all" ? "all" : filter;
  // A feliratkozólista oszlopai (rendezhetők, méretezhetők)
  const columns: GridColumn<NewsletterSubscriber>[] = [
    { key: "email", label: n.columns.email, width: 260, sortValue: (row) => row.email, render: (row) => row.email },
    { key: "name", label: n.columns.name, width: 180, sortValue: (row) => row.name || null, render: (row) => row.name || "–" },
    { key: "lang", label: n.columns.lang, width: 90, sortValue: (row) => row.lang, render: (row) => row.lang.toUpperCase() },
    { key: "status", label: n.columns.status, width: 170, sortValue: (row) => n.statuses[row.status], render: (row) => n.statuses[row.status] },
    {
      key: "source",
      label: n.columns.source,
      width: 150,
      sortValue: (row) => sourceLabels[row.source] ?? row.source,
      render: (row) => sourceLabels[row.source] ?? row.source,
    },
    { key: "consentAt", label: n.columns.subscribed, width: 180, sortValue: (row) => row.consentAt, render: (row) => when(row.consentAt) },
    { key: "confirmedAt", label: n.columns.confirmed, width: 180, sortValue: (row) => row.confirmedAt, render: (row) => when(row.confirmedAt) },
    {
      key: "actions",
      label: "",
      width: 90,
      render: (row) => (
        <button type="button" className="text-red-600 underline" onClick={() => void remove(row)}>
          {t.common.delete}
        </button>
      ),
    },
  ];
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">{n.title}</h1>
        <div className="flex flex-wrap gap-2">
          <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/newsletter/export?status=${exportStatus}`}>
            {filter === "all" ? n.csvAll : fmt(n.csvFiltered, { status: n.statuses[filter].toLowerCase() })}
          </a>
          <a className={buttonVariants({ variant: "secondary", size: "sm" })} href={`/api/admin/newsletter/export?status=${exportStatus}&format=xlsx`}>
            {t.common.excel}
          </a>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {STATUSES.map((status) => (
          <Card key={status}>
            <Card.Header>
              <Card.Description>{n.statuses[status]}</Card.Description>
              <Card.Title className="text-3xl">{counts[status]}</Card.Title>
            </Card.Header>
          </Card>
        ))}
      </div>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1 text-sm sm:mx-0 sm:flex-wrap sm:px-0">
        {(["all", ...STATUSES] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`shrink-0 whitespace-nowrap rounded-full border px-3 py-1 transition-colors ${filter === option ? "border-accent bg-accent font-semibold text-accent-foreground shadow-sm" : "border-foreground/20 hover:border-accent/60 hover:bg-accent/10"}`}
            onClick={() => setFilter(option)}
          >
            {option === "all" ? n.all : n.statuses[option]}
          </button>
        ))}
      </div>
      <p className="text-xs text-foreground/60">{n.hint}</p>
      <DataGrid
        rows={subscribers}
        columns={columns}
        rowKey={(subscriber) => subscriber.id}
        storageKey="admin:newsletter"
        emptyText={n.empty}
        resetKey={filter}
        renderCard={(subscriber) => (
          <div className="rounded-xl border border-foreground/10 bg-background p-3 text-sm">
            <div className="break-all font-semibold">{subscriber.email}</div>
            <div className="text-foreground/60">
              {subscriber.name || "–"} · {subscriber.lang.toUpperCase()} · {n.statuses[subscriber.status]} ·{" "}
              {sourceLabels[subscriber.source] ?? subscriber.source}
            </div>
            <div className="text-foreground/60">
              {n.columns.subscribed}: {when(subscriber.consentAt)} · {n.columns.confirmed}: {when(subscriber.confirmedAt)}
            </div>
            <div className="mt-2">
              <Button size="sm" variant="danger" onPress={() => void remove(subscriber)}>
                {t.common.delete}
              </Button>
            </div>
          </div>
        )}
      />
    </div>
  );
}
