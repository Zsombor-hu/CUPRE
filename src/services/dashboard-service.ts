import "server-only";
import { getCustomerDb } from "@/services/customer-db";
import { listOrders, orderStatusCounts } from "@/services/order-admin-service";
import { getAdminProducts } from "@/services/product-service";
import { LOW_STOCK_THRESHOLD } from "@/types/product";
import type { DashboardData, DashboardPeriod } from "@/types/admin-dashboard";

// A napi grafikon hossza (nap)
const CHART_DAYS = 30;

// Budapesti naptári nap (ÉÉÉÉ-HH-NN) egy időpontból
function budapestDay(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(date);
}

// SQLite UTC időbélyeg → Date
function fromSqlite(value: string): Date {
  return new Date(`${value.replace(" ", "T")}Z`);
}

// Rendelésszám és összeg egy feltétellel (a lemondottak nélkül)
function sumOrders(condition: string, params: (string | number)[] = []): DashboardPeriod {
  const row = getCustomerDb()
    .prepare(`SELECT COUNT(*) AS orders, COALESCE(SUM(total_huf), 0) AS totalHuf FROM orders WHERE status <> 'canceled' AND ${condition}`)
    .get(...params) as { orders: number; totalHuf: number };
  return { orders: Number(row.orders), totalHuf: Number(row.totalHuf) };
}

// Az admin áttekintő oldal összes adata egy lekérésben
export function getDashboard(): DashboardData {
  const db = getCustomerDb();
  const now = new Date();
  const today = budapestDay(now);
  // Az utolsó 31 nap rendelései (a napi bontás budapesti nap szerint, ezért JS-ben csoportosítunk)
  const since = new Date(now.getTime() - (CHART_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString().replace("T", " ").slice(0, 19);
  const recent = db
    .prepare("SELECT created_at AS createdAt, total_huf AS totalHuf FROM orders WHERE status <> 'canceled' AND created_at >= ?")
    .all(since) as { createdAt: string; totalHuf: number }[];

  const days: string[] = [];
  // A grafikon napjai a legrégebbitől máig
  for (let offset = CHART_DAYS - 1; offset >= 0; offset -= 1) {
    days.push(budapestDay(new Date(now.getTime() - offset * 24 * 60 * 60 * 1000)));
  }
  const buckets = new Map(days.map((day) => [day, { date: day, orders: 0, totalHuf: 0 }]));
  // Rendelések napokra bontása
  for (const order of recent) {
    const bucket = buckets.get(budapestDay(fromSqlite(order.createdAt)));
    // A grafikon ablakán kívül eső rendelés kimarad
    if (bucket) {
      bucket.orders += 1;
      bucket.totalHuf += Number(order.totalHuf);
    }
  }
  const daily = days.map((day) => buckets.get(day) ?? { date: day, orders: 0, totalHuf: 0 });
  // Napok összesítése egy időszakra
  const total = (list: typeof daily): DashboardPeriod => ({
    orders: list.reduce((sum, day) => sum + day.orders, 0),
    totalHuf: list.reduce((sum, day) => sum + day.totalHuf, 0),
  });

  const topVariants = (
    db
      .prepare(
        `SELECT i.sku, i.product_name AS productName, i.size, i.grade, SUM(i.qty) AS qty, SUM(i.qty * i.unit_price_huf) AS totalHuf
         FROM order_items i JOIN orders o ON o.id = i.order_id
         WHERE o.status <> 'canceled' AND o.created_at >= ?
         GROUP BY i.sku, i.product_name, i.size, i.grade ORDER BY qty DESC LIMIT 5`,
      )
      .all(since) as DashboardData["topVariants"]
  ).map((row) => ({ ...row, qty: Number(row.qty), totalHuf: Number(row.totalHuf) }));

  const lowStock: DashboardData["lowStock"] = [];
  // Alacsony készletű (nyilvántartott, bekapcsolt) változatok
  for (const product of getAdminProducts()) {
    // A termék változatai egyenként
    for (const variant of product.variants) {
      // Csak a nyilvántartott, rendelhető változatok érdekesek
      if (product.active && variant.active && variant.stock !== null && variant.stock <= LOW_STOCK_THRESHOLD) {
        lowStock.push({ sku: variant.sku, productName: product.name, size: variant.size, grade: variant.grade, stock: variant.stock });
      }
    }
  }
  lowStock.sort((a, b) => a.stock - b.stock);

  const missing = db
    .prepare("SELECT COUNT(*) AS count FROM orders WHERE status <> 'canceled' AND payment_status = 'paid' AND invoice_number IS NULL")
    .get() as { count: number };

  return {
    periods: {
      today: total(daily.filter((day) => day.date === today)),
      week: total(daily.slice(-7)),
      month: total(daily),
    },
    statusCounts: orderStatusCounts(),
    awaitingTransfer: sumOrders("payment_status = 'awaiting_transfer'"),
    awaitingCod: sumOrders("payment_status = 'awaiting_cod'"),
    missingInvoices: Number(missing.count),
    daily,
    topVariants,
    lowStock,
    recentOrders: listOrders({}, 6),
  };
}
