import type { AdminOrderListItem, OrderStatus } from "@/types/admin-order";

// Egy időszak összesítője (a lemondott rendelések nélkül)
export type DashboardPeriod = { orders: number; totalHuf: number };

// Az admin áttekintő oldal adatai
export type DashboardData = {
  periods: { today: DashboardPeriod; week: DashboardPeriod; month: DashboardPeriod };
  // Darabszám rendelésállapotonként (teendők)
  statusCounts: Record<OrderStatus, number>;
  // Beérkezésre váró átutalások és utánvétek
  awaitingTransfer: DashboardPeriod;
  awaitingCod: DashboardPeriod;
  // Kifizetett, nem lemondott, de számla nélküli rendelések száma
  missingInvoices: number;
  // Napi bevétel az utolsó 30 napban (budapesti nap szerint, a legrégebbi elöl)
  daily: { date: string; orders: number; totalHuf: number }[];
  // Legkelendőbb változatok az utolsó 30 napban
  topVariants: { sku: string; productName: string; size: string; grade: string; qty: number; totalHuf: number }[];
  // Alacsony vagy elfogyott készletű változatok
  lowStock: { sku: string; productName: string; size: string; grade: string; stock: number }[];
  recentOrders: AdminOrderListItem[];
};
