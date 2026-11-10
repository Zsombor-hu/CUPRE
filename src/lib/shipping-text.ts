import { formatPrice, interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import type { ShippingSummary } from "@/types/order";

// A szállítás szöveges sorai (visszaigazoló levél): mód, díj, várható idő, átvételi pontnál a pont neve és címe
export function shippingLines(dict: Dictionary, summary: ShippingSummary, lang: Locale): string[] {
  const t = dict.shipping;
  // Szállítási mód nélküli rendelés: csak a díj egyeztetéséről szólunk
  if (summary.method === "none") {
    return [`${t.title}: ${dict.checkoutLegal.shippingPending}`];
  }
  const carrier = summary.carrierName ? ` (${summary.carrierName})` : "";
  const lines = [
    `${t.title}: ${t.methods[summary.method]}${carrier} – ${formatPrice(summary.feeHuf, lang)}`,
  ];
  // Várható szállítási idő, ha be van állítva
  if (summary.deliveryDays) {
    lines.push(interpolate(t.deliveryDays, { days: summary.deliveryDays }));
  }
  // Átvételi pont neve és címe
  if (summary.pickupPoint) {
    lines.push(`${t.pickupPoint}: ${summary.pickupPoint.name}, ${summary.pickupPoint.address}`);
  }
  return lines;
}
