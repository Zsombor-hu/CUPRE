"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { localePath } from "@/lib/i18n";

// Fejlesztői teszt „fizetőoldal”: kártyaadatot nem kér, csak a kimenetet választja ki (siker / sikertelen / megszakítás),
// majd visszavisz az eredményoldalra – ahogy a Barion is tenné
export default function MockPayment() {
  const { lang, dict } = useI18n();
  const params = useSearchParams();
  const router = useRouter();
  const order = params.get("order") ?? "";
  const token = params.get("token") ?? "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const t = dict.payment.mock;

  // Kimenet rögzítése, majd vissza az eredményoldalra
  async function complete(outcome: "paid" | "failed" | "canceled") {
    setBusy(true);
    const response = await fetch("/api/payments/mock/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order, token, outcome }),
    });
    // A teszt-szolgáltató nem elérhető (pl. production környezet) vagy rossz token
    if (!response.ok) {
      setBusy(false);
      setError(true);
      return;
    }
    router.push(
      `${localePath(lang, "/fizetes/eredmeny")}?order=${encodeURIComponent(order)}&token=${encodeURIComponent(token)}`,
    );
  }

  return (
    <div className="mock-payment">
      <p className="account-notice">{t.text}</p>
      {error ? <p className="checkout-error">{dict.payment.result.invalid}</p> : null}
      <div className="account-actions">
        <button className="btn btn-copper" type="button" disabled={busy} onClick={() => void complete("paid")}>
          {t.success}
        </button>
        <button className="btn btn-outline-dark" type="button" disabled={busy} onClick={() => void complete("failed")}>
          {t.fail}
        </button>
        <button className="btn btn-outline-dark" type="button" disabled={busy} onClick={() => void complete("canceled")}>
          {t.cancel}
        </button>
      </div>
    </div>
  );
}
