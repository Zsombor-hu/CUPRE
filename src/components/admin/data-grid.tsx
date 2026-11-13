"use client";

import { useState, type ReactNode } from "react";
import { Button } from "@heroui/react";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { PAGE_SIZES } from "@/types/admin-settings";

// Egy oszlop leírása: felirat, kezdő szélesség, cella-megjelenítés, és (ha rendezhető) a rendezési érték
export type GridColumn<T> = {
  key: string;
  label: string;
  width?: number;
  render: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number | null;
  align?: "left" | "right";
};

// Rendezési állapot
type Sort = { key: string; dir: "asc" | "desc" } | null;

// Legkisebb oszlopszélesség húzásnál (px)
const MIN_WIDTH = 60;

// Alapértelmezett oszlopszélesség (px), ha az oszlop nem ad meg mást
const DEFAULT_WIDTH = 160;

type Props<T> = {
  rows: T[];
  columns: GridColumn<T>[];
  rowKey: (row: T) => string | number;
  // Mobil nézetben (md alatt) a sorok helyett ezek a kártyák jelennek meg
  renderCard: (row: T) => ReactNode;
  // Az oszlopszélességek mentési kulcsa a böngészőben (a lapméret felhasználónként a beállításokban van)
  storageKey: string;
  emptyText: string;
  defaultSort?: Sort;
  // Ha változik (pl. szűrő), visszaugrunk az első oldalra
  resetKey?: string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | number | null;
};

// Mentett beállítás olvasása a böngészőből (hiba vagy hiány esetén az alapérték)
function readStored<V>(key: string, fallback: V): V {
  try {
    const raw = window.localStorage.getItem(key);
    // Nincs mentett érték
    if (raw === null) {
      return fallback;
    }
    return JSON.parse(raw) as V;
  } catch {
    return fallback;
  }
}

// Beállítás mentése a böngészőbe (privát módban csendben elmarad)
function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A mentés hiánya nem akadályozza a működést
  }
}

// Két rendezési érték összehasonlítása; a hiányzó érték mindig a végére kerül
function compareValues(a: string | number | null, b: string | number | null): number {
  // Mindkettő hiányzik
  if (a === null && b === null) {
    return 0;
  }
  // Csak az egyik hiányzik
  if (a === null) {
    return 1;
  }
  // Csak a másik hiányzik
  if (b === null) {
    return -1;
  }
  // Számok
  if (typeof a === "number" && typeof b === "number") {
    return a - b;
  }
  return String(a).localeCompare(String(b), "hu", { numeric: true, sensitivity: "base" });
}

// Rendezés irányát jelző nyíl
function SortIcon({ dir }: { dir: "asc" | "desc" | null }) {
  return (
    <span aria-hidden="true" className={`text-xs ${dir ? "text-foreground" : "text-foreground/30"}`}>
      {dir === "asc" ? "▲" : dir === "desc" ? "▼" : "↕"}
    </span>
  );
}

// Lapozó ikonok útvonalai: első (|<), előző (<), következő (>), utolsó (>|)
const PAGE_ICON_PATHS: Record<"first" | "prev" | "next" | "last", string> = {
  first: "M17 18l-6-6 6-6M7 6v12",
  prev: "M15 18l-6-6 6-6",
  next: "M9 6l6 6-6 6",
  last: "M7 6l6 6-6 6M17 6v12",
};

// Lapozó gomb ikonja
function PageIcon({ kind }: { kind: keyof typeof PAGE_ICON_PATHS }) {
  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
      <path d={PAGE_ICON_PATHS[kind]} />
    </svg>
  );
}

// Admin táblázat: fejlécre kattintva rendezés (növekvő/csökkenő), húzással méretezhető oszlopok,
// állítható lapméret, lapozás és összesítő; mobilon kártyalista rendezőválasztóval
export default function DataGrid<T>({
  rows,
  columns,
  rowKey,
  renderCard,
  storageKey,
  emptyText,
  defaultSort = null,
  resetKey = "",
  onRowClick,
  selectedKey = null,
}: Props<T>) {
  const [sort, setSort] = useState<Sort>(defaultSort);
  const { t, fmt, settings, updateSettings } = useAdminI18n();
  const pageSize = settings.pageSize;
  const [page, setPage] = useState(1);
  const [widths, setWidths] = useState<Record<string, number>>(() => readStored(`${storageKey}:widths`, {}));
  const [prevResetKey, setPrevResetKey] = useState(resetKey);

  // Szűrőváltáskor vissza az első oldalra (renderelés közbeni állapotigazítás)
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setPage(1);
  }

  const sortColumn = sort ? columns.find((column) => column.key === sort.key) : undefined;
  const sorted = [...rows];
  // Rendezés a kiválasztott oszlop szerint
  if (sort && sortColumn?.sortValue) {
    const value = sortColumn.sortValue;
    sorted.sort((a, b) => compareValues(value(a), value(b)) * (sort.dir === "asc" ? 1 : -1));
  }

  const total = sorted.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(page, pageCount);
  const pageRows = sorted.slice((current - 1) * pageSize, current * pageSize);
  const widthOf = (column: GridColumn<T>) => widths[column.key] ?? column.width ?? DEFAULT_WIDTH;
  const tableWidth = columns.reduce((sum, column) => sum + widthOf(column), 0);
  const sortable = columns.filter((column) => column.sortValue);

  // Fejlécre kattintás: új oszlopnál növekvő, ugyanannál irányváltás
  function toggleSort(key: string) {
    setSort((previous) => (previous?.key === key ? { key, dir: previous.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));
    setPage(1);
  }

  // Lapméret váltása (a felhasználó beállításaiba mentve)
  function changePageSize(size: number) {
    setPage(1);
    void updateSettings({ pageSize: size });
  }

  // Oszlop szélességének húzása a fejléc jobb szélén lévő fogantyúval
  function startResize(event: React.PointerEvent<HTMLSpanElement>, column: GridColumn<T>) {
    event.preventDefault();
    event.stopPropagation();
    const startX = event.clientX;
    const startWidth = widthOf(column);
    let latest = widths;

    // Húzás közben az új szélesség
    function onMove(move: PointerEvent) {
      latest = { ...latest, [column.key]: Math.max(MIN_WIDTH, Math.round(startWidth + move.clientX - startX)) };
      setWidths(latest);
    }

    // Húzás vége: eseménykezelők leszedése, mentés
    function onUp() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.cursor = "";
      writeStored(`${storageKey}:widths`, latest);
    }

    document.body.style.cursor = "col-resize";
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  // Dupla kattintás a fogantyún: az oszlop visszaáll az alapszélességre
  function resetWidth(column: GridColumn<T>) {
    const next = { ...widths };
    delete next[column.key];
    setWidths(next);
    writeStored(`${storageKey}:widths`, next);
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      {sortable.length > 0 ? (
        <div className="flex items-center gap-2 text-sm md:hidden">
          <label className="flex min-w-0 flex-1 items-center gap-2">
            <span className="shrink-0 text-foreground/60">{t.grid.sortBy}</span>
            <select
              className="min-w-0 flex-1 rounded-lg border border-foreground/20 bg-transparent px-2 py-1.5"
              value={sort?.key ?? ""}
              onChange={(event) => {
                setSort(event.target.value ? { key: event.target.value, dir: sort?.dir ?? "asc" } : null);
                setPage(1);
              }}
            >
              <option value="">{t.grid.sortDefault}</option>
              {sortable.map((column) => (
                <option key={column.key} value={column.key}>
                  {column.label}
                </option>
              ))}
            </select>
          </label>
          <Button
            size="sm"
            variant="secondary"
            isDisabled={!sort}
            aria-label={sort?.dir === "desc" ? t.grid.descending : t.grid.ascending}
            onPress={() => {
              // Csak kiválasztott oszlopnál van irány
              if (sort) {
                toggleSort(sort.key);
              }
            }}
          >
            <SortIcon dir={sort?.dir ?? null} />
          </Button>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2 md:hidden">
        {pageRows.length === 0 ? <li className="py-4 text-sm text-foreground/60">{emptyText}</li> : null}
        {pageRows.map((row) => (
          <li key={rowKey(row)}>{renderCard(row)}</li>
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-xl border border-foreground/10 md:block">
        <table className="min-w-full table-fixed text-left text-sm" style={{ width: tableWidth }}>
          <colgroup>
            {columns.map((column) => (
              <col key={column.key} style={{ width: widthOf(column) }} />
            ))}
          </colgroup>
          <thead className="bg-foreground/5">
            <tr>
              {columns.map((column) => {
                const dir = sort?.key === column.key ? sort.dir : null;
                return (
                  <th
                    key={column.key}
                    className="relative select-none px-3 py-2 font-semibold"
                    aria-sort={dir === "asc" ? "ascending" : dir === "desc" ? "descending" : undefined}
                  >
                    {column.sortValue ? (
                      <button
                        type="button"
                        className={`flex w-full items-center gap-1 ${column.align === "right" ? "justify-end" : ""}`}
                        onClick={() => toggleSort(column.key)}
                        title={t.grid.sortTitle}
                      >
                        <span className="truncate">{column.label}</span>
                        <SortIcon dir={dir} />
                      </button>
                    ) : (
                      <span className="block truncate">{column.label}</span>
                    )}
                    <span
                      role="separator"
                      aria-orientation="vertical"
                      aria-label={fmt(t.grid.columnWidth, { label: column.label })}
                      title={t.grid.resizeHint}
                      className="absolute right-0 top-0 h-full w-2 cursor-col-resize touch-none border-r border-foreground/10 hover:border-r-2 hover:border-accent"
                      onPointerDown={(event) => startResize(event, column)}
                      onDoubleClick={() => resetWidth(column)}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-foreground/60" colSpan={columns.length}>
                  {emptyText}
                </td>
              </tr>
            ) : null}
            {pageRows.map((row) => {
              const key = rowKey(row);
              return (
                <tr
                  key={key}
                  className={`border-t border-foreground/10 ${onRowClick ? "cursor-pointer hover:bg-foreground/5" : ""} ${selectedKey === key ? "bg-foreground/10" : ""}`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key} className={`overflow-hidden px-3 py-2 align-top break-words ${column.align === "right" ? "text-right" : ""}`}>
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 items-center gap-2 text-sm lg:grid-cols-[1fr_auto_1fr]">
        <span className="text-foreground/70">
          {t.grid.total} <strong className="text-foreground">{total}</strong> {t.grid.items}
        </span>
        <div className="flex justify-end text-foreground/70 lg:order-last">
          <label className="flex items-center gap-1">
            {t.grid.pageSize}
            <select
              className="rounded-lg border border-foreground/20 bg-transparent px-2 py-1"
              value={pageSize}
              onChange={(event) => changePageSize(Number(event.target.value))}
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </div>
        <nav className="col-span-2 flex items-center justify-center gap-1 lg:col-span-1" aria-label={t.grid.pagination}>
          <Button size="sm" variant="secondary" isIconOnly isDisabled={current <= 1} aria-label={t.grid.first} onPress={() => setPage(1)}>
            <PageIcon kind="first" />
          </Button>
          <Button size="sm" variant="secondary" isIconOnly isDisabled={current <= 1} aria-label={t.grid.prev} onPress={() => setPage(current - 1)}>
            <PageIcon kind="prev" />
          </Button>
          <span className="whitespace-nowrap px-2 tabular-nums">
            {fmt(t.grid.page, { current, count: pageCount })}
          </span>
          <Button size="sm" variant="secondary" isIconOnly isDisabled={current >= pageCount} aria-label={t.grid.next} onPress={() => setPage(current + 1)}>
            <PageIcon kind="next" />
          </Button>
          <Button size="sm" variant="secondary" isIconOnly isDisabled={current >= pageCount} aria-label={t.grid.last} onPress={() => setPage(pageCount)}>
            <PageIcon kind="last" />
          </Button>
        </nav>
      </div>
    </div>
  );
}
