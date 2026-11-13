"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import type { DashboardData, DashboardPeriod } from "@/types/admin-dashboard";

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; data: DashboardData };

// Időszak-csempe: bevétel és rendelésszám
function PeriodTile({ title, period }: { title: string; period: DashboardPeriod }) {
  const { t, fmt, huf } = useAdminI18n();
  return (
    <Card>
      <Card.Content className="flex flex-col gap-1">
        <span className="text-sm text-foreground/60">{title}</span>
        <span className="text-2xl font-semibold tabular-nums">{huf(period.totalHuf)}</span>
        <span className="text-sm text-foreground/60">{fmt(t.dashboard.ordersCount, { count: period.orders })}</span>
      </Card.Content>
    </Card>
  );
}

// Teendő sor: felirat, darabszám (és opcionálisan összeg), link a szűrt rendeléslistára
function TaskRow({ href, title, count, amount }: { href: string; title: string; count: number; amount?: string }) {
  return (
    <li>
      <Link
        href={href}
        className={`flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-foreground/5 ${count > 0 ? "" : "text-foreground/50"}`}
      >
        <span className="min-w-0 truncate">{title}</span>
        <span className="flex shrink-0 items-baseline gap-2">
          {amount ? <span className="text-sm text-foreground/60">{amount}</span> : null}
          <span className={`min-w-8 rounded-full px-2 text-center text-sm font-semibold tabular-nums ${count > 0 ? "bg-accent text-accent-foreground" : "bg-foreground/10"}`}>
            {count}
          </span>
        </span>
      </Link>
    </li>
  );
}

// Napi bevétel oszlopdiagram (egy adatsor, egy szín; az oszlop fölé állva tooltip mutatja a napot, az összeget és a darabszámot)
function DailyChart({ daily }: { daily: DashboardData["daily"] }) {
  const { t, fmt, huf, lang } = useAdminI18n();
  const [hover, setHover] = useState<number | null>(null);
  const width = 720;
  const height = 200;
  const padTop = 16;
  const padBottom = 24;
  const gap = 2;
  const max = Math.max(1, ...daily.map((day) => day.totalHuf));
  const barWidth = width / daily.length - gap;
  const plotHeight = height - padTop - padBottom;
  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString(lang, { month: "short", day: "numeric" });
  const active = hover !== null ? daily[hover] : null;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-52 w-full" role="img" aria-label={t.dashboard.chartAria} preserveAspectRatio="none">
        <line x1="0" x2={width} y1={height - padBottom} y2={height - padBottom} className="stroke-foreground/20" strokeWidth="1" />
        <line x1="0" x2={width} y1={padTop} y2={padTop} className="stroke-foreground/10" strokeWidth="1" strokeDasharray="3 3" />
        {daily.map((day, index) => {
          const barHeight = day.totalHuf > 0 ? Math.max(3, (day.totalHuf / max) * plotHeight) : 0;
          const x = index * (barWidth + gap) + gap / 2;
          const y = height - padBottom - barHeight;
          return (
            <g key={day.date}>
              {barHeight > 0 ? (
                <path
                  d={`M${x},${height - padBottom} V${y + 4} Q${x},${y} ${x + 4},${y} H${x + barWidth - 4} Q${x + barWidth},${y} ${x + barWidth},${y + 4} V${height - padBottom} Z`}
                  className={hover === index ? "fill-accent" : "fill-accent/70"}
                />
              ) : null}
              <rect
                x={x - gap / 2}
                y={0}
                width={barWidth + gap}
                height={height}
                fill="transparent"
                onMouseEnter={() => setHover(index)}
                onMouseLeave={() => setHover(null)}
              >
                <title>{fmt(t.dashboard.chartTooltip, { date: dayLabel(day.date), total: huf(day.totalHuf), count: day.orders })}</title>
              </rect>
            </g>
          );
        })}
      </svg>
      <div className="flex justify-between text-xs text-foreground/60">
        <span>{dayLabel(daily[0].date)}</span>
        <span>{fmt(t.dashboard.chartMax, { total: huf(max) })}</span>
        <span>{dayLabel(daily[daily.length - 1].date)}</span>
      </div>
      {active ? (
        <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 rounded-lg border border-foreground/10 bg-background px-3 py-1.5 text-sm shadow-md">
          <span className="font-semibold">{dayLabel(active.date)}</span> · {huf(active.totalHuf)} · {fmt(t.dashboard.ordersCount, { count: active.orders })}
        </div>
      ) : null}
    </div>
  );
}

// Admin áttekintő oldal: bevétel (ma / 7 nap / 30 nap), teendők, napi grafikon, toplista, alacsony készlet, legutóbbi rendelések
export default function DashboardAdmin() {
  const { t, fmt, huf, when } = useAdminI18n();
  const [state, setState] = useState<State>({ kind: "loading" });

  // Adatok betöltése; 403: letiltott admin, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/dashboard", { cache: "no-store" });
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
    setState({ kind: "ready", data: (await response.json()) as DashboardData });
  }, []);

  // Betöltés indításkor és percenként (új rendelések)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- az adatok csak a kliensen, az admin süti alapján kérdezhetők le
    void load();
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
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

  const data = state.data;
  const d = t.dashboard;
  const grade = (value: string) => (value === "first" ? t.orders.detail.firstGrade : t.orders.detail.secondGrade);
  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">{d.title}</h1>
        <Button size="sm" variant="secondary" onPress={() => void load()}>
          {t.common.refresh}
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <PeriodTile title={d.today} period={data.periods.today} />
        <PeriodTile title={d.week} period={data.periods.week} />
        <PeriodTile title={d.month} period={data.periods.month} />
      </div>
      <p className="-mt-2 text-xs text-foreground/60">{d.noteRevenue}</p>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
        <Card>
          <Card.Header>
            <Card.Title>{d.tasks}</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="-mx-3 flex flex-col">
              <TaskRow href="/admin/rendelesek?status=new" title={d.newOrders} count={data.statusCounts.new} />
              <TaskRow href="/admin/rendelesek?status=processing" title={d.processing} count={data.statusCounts.processing} />
              <TaskRow
                href="/admin/rendelesek?paymentStatus=awaiting_transfer"
                title={d.awaitingTransfer}
                count={data.awaitingTransfer.orders}
                amount={data.awaitingTransfer.orders > 0 ? huf(data.awaitingTransfer.totalHuf) : undefined}
              />
              <TaskRow
                href="/admin/rendelesek?paymentStatus=awaiting_cod"
                title={d.awaitingCod}
                count={data.awaitingCod.orders}
                amount={data.awaitingCod.orders > 0 ? huf(data.awaitingCod.totalHuf) : undefined}
              />
              <TaskRow href="/admin/rendelesek?invoice=missing" title={d.missingInvoices} count={data.missingInvoices} />
              <TaskRow href="/admin/termekek" title={d.lowStockTitle} count={data.lowStock.length} />
            </ul>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>{d.chartTitle}</Card.Title>
          </Card.Header>
          <Card.Content>
            <DailyChart daily={data.daily} />
          </Card.Content>
        </Card>
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Card>
          <Card.Header>
            <Card.Title>{d.topTitle}</Card.Title>
          </Card.Header>
          <Card.Content>
            {data.topVariants.length === 0 ? <p className="text-sm text-foreground/60">{d.topEmpty}</p> : null}
            <ol className="flex flex-col gap-2 text-sm">
              {data.topVariants.map((variant, index) => (
                <li key={variant.sku} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">
                    <span className="text-foreground/50">{index + 1}. </span>
                    {variant.productName} · {variant.size} · {grade(variant.grade)}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {fmt(t.orders.detail.qty, { qty: variant.qty })} <span className="text-foreground/60">· {huf(variant.totalHuf)}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>{d.lowStockTitle}</Card.Title>
          </Card.Header>
          <Card.Content>
            {data.lowStock.length === 0 ? <p className="text-sm text-foreground/60">{d.lowStockEmpty}</p> : null}
            <ul className="flex flex-col gap-2 text-sm">
              {data.lowStock.map((variant) => (
                <li key={variant.sku} className="flex items-baseline justify-between gap-2">
                  <span className="min-w-0">
                    {variant.productName} · {variant.size} · {grade(variant.grade)}
                  </span>
                  <span className={`shrink-0 font-semibold tabular-nums ${variant.stock <= 0 ? "text-danger" : "text-warning"}`}>
                    {variant.stock <= 0 ? t.products.soldOut : fmt(d.lowStockItem, { stock: variant.stock })}
                  </span>
                </li>
              ))}
            </ul>
            <Link className="mt-3 inline-block text-sm text-accent underline-offset-2 hover:underline" href="/admin/termekek">
              {d.manageStock} →
            </Link>
          </Card.Content>
        </Card>
        <Card>
          <Card.Header>
            <Card.Title>{d.recentTitle}</Card.Title>
          </Card.Header>
          <Card.Content>
            <ul className="-mx-3 flex flex-col text-sm">
              {data.recentOrders.map((order) => (
                <li key={order.id}>
                  <Link className="flex items-baseline justify-between gap-2 rounded-lg px-3 py-1.5 hover:bg-foreground/5" href={`/admin/rendelesek?id=${order.id}`}>
                    <span className="min-w-0 truncate">
                      <span className="font-semibold">#{order.id}</span> {order.name}
                      <span className="block text-xs text-foreground/60">
                        {when(order.createdAt)} · {(t.orders.statuses as Record<string, string>)[order.status] ?? order.status}
                      </span>
                    </span>
                    <span className="shrink-0 tabular-nums">{huf(order.totalHuf)}</span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link className="mt-2 inline-block text-sm text-accent underline-offset-2 hover:underline" href="/admin/rendelesek">
              {d.viewAll}
            </Link>
          </Card.Content>
        </Card>
      </div>
    </div>
  );
}
