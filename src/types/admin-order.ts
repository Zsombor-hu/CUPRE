import type { AuditEntry } from "@/types/admin-audit";
import type { PaymentMethod, PaymentStatus, ShippingMethod } from "@/types/order";

// A rendelés feldolgozási állapota (a fizetési állapottól független)
export type OrderStatus = "new" | "processing" | "shipped" | "completed" | "canceled";

// Az összes állapot a felület sorrendjében
export const ORDER_STATUSES: OrderStatus[] = ["new", "processing", "shipped", "completed", "canceled"];

// A szokásos feldolgozási sorrend következő lépése („Következő lépés” gomb); a lezárt állapotoknál nincs következő
export const NEXT_ORDER_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  new: "processing",
  processing: "shipped",
  shipped: "completed",
};

// Rendelés az admin listában
export type AdminOrderListItem = {
  id: number;
  createdAt: string;
  status: OrderStatus;
  totalHuf: number;
  name: string;
  email: string;
  city: string;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
  couponCode: string | null;
  lang: string;
  trackingNumber: string | null;
  invoiceNumber: string | null;
};

// Rendelés részletei az admin oldalon
export type AdminOrderDetail = AdminOrderListItem & {
  phone: string;
  postcode: string;
  address: string;
  note: string;
  accountId: number | null;
  shippingFeeHuf: number;
  paymentFeeHuf: number;
  discountHuf: number;
  pickupPoint: { id: string | null; name: string; address: string } | null;
  paymentRef: string | null;
  paidAt: string | null;
  termsAcceptedAt: string | null;
  customerId: number;
  trackingUrl: string | null;
  internalNote: string;
  invoiceIssuedAt: string | null;
  hasInvoiceFile: boolean;
  items: { sku: string; productName: string; size: string; grade: string; qty: number; unitPriceHuf: number }[];
  history: { status: string; note: string; adminName: string | null; createdAt: string }[];
  paymentEvents: { provider: string; status: string; createdAt: string }[];
  // Az admin napló rendeléshez tartozó bejegyzései (az állapotváltás kivételével, az a history-ban van)
  activity: AuditEntry[];
};

// Lista szűrői
export type AdminOrderFilter = {
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  q?: string;
  // Csak a számla nélküli, nem lemondott, kifizetett rendelések (?invoice=missing)
  missingInvoice?: boolean;
};
