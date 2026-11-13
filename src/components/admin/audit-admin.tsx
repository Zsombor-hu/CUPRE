"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AdminRedirect from "@/components/admin/admin-redirect";
import DataGrid, { type GridColumn } from "@/components/admin/data-grid";
import { useAdminI18n, type AdminDictionary } from "@/components/admin/admin-i18n";
import { auditActionLabel, auditDetails } from "@/components/admin/audit-text";
import type { AuditEntry } from "@/types/admin-audit";

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; entries: AuditEntry[] };

// Az érintett elem felirata és (ha van ilyen oldal) linkje
function target(t: AdminDictionary, entry: AuditEntry): { text: string; href: string | null } {
  const entities: Record<string, string> = t.audit.entities;
  const name = entities[entry.entity] ?? entry.entity;
  // Rendelés: a rendelés részletei
  if (entry.entity === "order") {
    return { text: `${name} #${entry.entityId}`, href: `/admin/rendelesek?id=${entry.entityId}` };
  }
  // Vásárló: a vásárló adatlapja
  if (entry.entity === "customer") {
    return { text: `${name} #${entry.entityId}`, href: `/admin/vasarlok?id=${entry.entityId}` };
  }
  return { text: `${name}: ${entry.entityId}`, href: null };
}

// Admin napló: ki, mikor, mit módosított (szűrés adminra és szabad szövegre)
export default function AuditAdmin() {
  const { t, when } = useAdminI18n();
  const a = t.audit;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [admin, setAdmin] = useState("");
  const [filter, setFilter] = useState("");

  // Napló betöltése; 403: letiltott admin, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/audit", { cache: "no-store" });
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
    setState({ kind: "ready", entries: ((await response.json()) as { entries: AuditEntry[] }).entries });
  }, []);

  // Első betöltés
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a napló csak a kliensen, az admin süti alapján kérdezhető le
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

  const admins = Array.from(new Set(state.entries.map((entry) => entry.adminName))).sort();
  const needle = filter.trim().toLowerCase();
  const rows = state.entries.filter((entry) => {
    // Admin szerinti szűrés
    if (admin && entry.adminName !== admin) {
      return false;
    }
    // Szabad szöveges szűrés a felirat, az elem és a részletek szövegében
    if (needle) {
      const haystack = `${auditActionLabel(t, entry)} ${target(t, entry).text} ${auditDetails(t, entry)} ${entry.adminName}`.toLowerCase();
      return haystack.includes(needle);
    }
    return true;
  });

  const c = a.columns;
  // A napló oszlopai
  const columns: GridColumn<AuditEntry>[] = [
    { key: "createdAt", label: c.when, width: 180, sortValue: (entry) => entry.createdAt, render: (entry) => when(entry.createdAt) },
    { key: "admin", label: c.admin, width: 130, sortValue: (entry) => entry.adminName, render: (entry) => entry.adminName },
    { key: "action", label: c.action, width: 200, sortValue: (entry) => auditActionLabel(t, entry), render: (entry) => auditActionLabel(t, entry) },
    {
      key: "target",
      label: c.target,
      width: 200,
      sortValue: (entry) => target(t, entry).text,
      render: (entry) => {
        const item = target(t, entry);
        return item.href ? (
          <Link className="text-accent underline-offset-2 hover:underline" href={item.href} onClick={(event) => event.stopPropagation()}>
            {item.text}
          </Link>
        ) : (
          item.text
        );
      },
    },
    { key: "details", label: c.details, width: 340, render: (entry) => auditDetails(t, entry) || <span className="text-foreground/40">–</span> },
  ];

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{a.title}</h1>
        <p className="text-sm text-foreground/60">{a.description}</p>
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <select className="rounded-lg border border-foreground/20 bg-transparent px-3 py-2" value={admin} onChange={(event) => setAdmin(event.target.value)}>
          <option value="">{a.allAdmins}</option>
          {admins.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <input
          className="w-full min-w-0 rounded-lg border border-foreground/20 bg-transparent px-3 py-2 sm:w-auto sm:min-w-64 sm:flex-1"
          placeholder={a.searchPlaceholder}
          value={filter}
          onChange={(event) => setFilter(event.target.value)}
        />
      </div>
      <DataGrid
        rows={rows}
        columns={columns}
        rowKey={(entry) => entry.id}
        storageKey="admin:audit"
        emptyText={a.empty}
        defaultSort={{ key: "createdAt", dir: "desc" }}
        resetKey={`${admin}|${needle}`}
        renderCard={(entry) => {
          const item = target(t, entry);
          const details = auditDetails(t, entry);
          return (
            <div className="rounded-xl border border-foreground/10 bg-background p-3 text-sm">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{auditActionLabel(t, entry)}</span>
                <span className="shrink-0 text-foreground/60">{entry.adminName}</span>
              </div>
              <div className="text-foreground/60">{when(entry.createdAt)}</div>
              <div>{item.href ? <Link className="text-accent" href={item.href}>{item.text}</Link> : item.text}</div>
              {details ? <div className="break-words text-foreground/70">{details}</div> : null}
            </div>
          );
        }}
      />
    </div>
  );
}
