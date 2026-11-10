"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import PaymentInstructions from "@/components/cupre/payment-instructions";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, interpolate, localePath } from "@/lib/i18n";
import type { PaymentSummary } from "@/types/order";

// Legfeljebb ennyiszer kérdezzük újra a függő fizetést (2 másodpercenként)
const MAX_POLLS = 15;

// Fizetési eredmény: a rendelés tokenjével kérdezi le az állapotot; függő fizetésnél rövid ideig újrakérdez,
// sikertelen/megszakított kártyás fizetésnél újrapróbálást kínál
export default function PaymentResult({ contactEmail }: { contactEmail: string }) {
  const { lang, dict } = useI18n();
  const params = useSearchParams();
  const orderId = params.get("order") ?? "";
  const token = params.get("token") ?? "";
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [tick, setTick] = useState(0);
  const polls = useRef(0);
  const t = dict.payment.result;

  // Állapot lekérdezése (a tick növelése újrakérdez); függő fizetésnél újabb lekérdezés ütemezése
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Aszinkron lekérdezés; a komponens lecsatolása után már nem állítunk állapotot
    async function fetchStatus() {
      const response = await fetch(
        `/api/payments/status?order=${encodeURIComponent(orderId)}&token=${encodeURIComponent(token)}`,
        { cache: "no-store" },
      );
      // Lecsatolt komponens
      if (cancelled) {
        return;
      }
      // Rossz token vagy ismeretlen rendelés
      if (!response.ok) {
        setInvalid(true);
        return;
      }
      const data = (await response.json()) as PaymentSummary;
      setSummary(data);
      // Még nincs végeredmény: néhányszor újrakérdezünk
      if (data.status === "pending" && polls.current < MAX_POLLS) {
        polls.current += 1;
        timer = setTimeout(() => setTick((value) => value + 1), 2000);
      }
    }
    void fetchStatus();
    return () => {
      cancelled = true;
      // Függő újrakérdezés törlése
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [orderId, token, tick]);

  // Újrapróbálás: új fizetés indul ugyanarra a rendelésre, és átirányítunk a fizetőoldalra
  async function retry() {
    setRetrying(true);
    const response = await fetch("/api/payments/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order: orderId, token }),
    });
    const data = (await response.json().catch(() => null)) as { redirectUrl?: string } | null;
    // Sikeres indítás: irány a fizetőoldal
    if (response.ok && data?.redirectUrl) {
      window.location.assign(data.redirectUrl);
      return;
    }
    setRetrying(false);
    setTick((value) => value + 1);
  }

  // Érvénytelen link
  if (invalid) {
    return <p className="account-notice">{t.invalid}</p>;
  }
  // Betöltés
  if (!summary) {
    return <p className="muted">{dict.account.loading}</p>;
  }

  const failed = summary.status === "failed" || summary.status === "canceled" || summary.status === "expired";
  const title =
    summary.status === "paid"
      ? t.successTitle
      : summary.status === "pending"
        ? t.pendingTitle
        : failed
          ? t.failedTitle
          : t.infoTitle;
  return (
    <div className="payment-result">
      <h2>{title}</h2>
      <p>
        {t.orderNumber}: <strong>#{summary.orderId}</strong> · {dict.checkout.total}:{" "}
        <strong>{formatPrice(summary.totalHuf, lang)}</strong>
      </p>
      {summary.status === "paid" ? <p className="account-notice">{t.successText}</p> : null}
      {summary.status === "pending" ? <p className="account-notice">{t.pendingText}</p> : null}
      {failed ? <p className="account-notice">{interpolate(t.failedText, { email: contactEmail })}</p> : null}
      {!failed && summary.status !== "paid" && summary.status !== "pending" ? <PaymentInstructions summary={summary} /> : null}
      <div className="account-actions">
        {failed && summary.method === "card" ? (
          <button className="btn btn-copper" type="button" disabled={retrying} onClick={() => void retry()}>
            {t.retry} <span>→</span>
          </button>
        ) : null}
        <Link className="btn btn-outline-dark" href={localePath(lang, "/")}>
          {dict.newsletter.backHome}
        </Link>
      </div>
    </div>
  );
}
