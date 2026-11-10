"use client";

import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, interpolate } from "@/lib/i18n";
import type { ShippingSummary } from "@/types/order";

// Szállítási adatok a visszaigazoláson: mód (futárcéggel), díj, várható idő és átvételi pontnál a pont
export default function ShippingInfo({ summary }: { summary: ShippingSummary | undefined }) {
  const { lang, dict } = useI18n();
  const t = dict.shipping;
  // Szállítási mód nélküli rendelésnél nincs mit mutatni
  if (!summary || summary.method === "none") {
    return null;
  }
  return (
    <div className="payment-instructions">
      <p>
        <strong>{t.title}:</strong> {t.methods[summary.method]}
        {summary.carrierName ? ` (${summary.carrierName})` : ""} – {formatPrice(summary.feeHuf, lang)}
      </p>
      {summary.deliveryDays ? <p className="muted">{interpolate(t.deliveryDays, { days: summary.deliveryDays })}</p> : null}
      {summary.pickupPoint ? (
        <p>
          <strong>{t.pickupPoint}:</strong> {summary.pickupPoint.name}, {summary.pickupPoint.address}
        </p>
      ) : null}
    </div>
  );
}
