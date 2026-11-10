"use client";

import { useState } from "react";
import { useI18n } from "@/hooks/use-i18n";
import type { CouponCheckResponse } from "@/types/coupon";

// Kuponkód mező a pénztár összesítőjében: beváltás előtt a szerver ellenőrzi; beváltott kupon eltávolítható
export default function CouponField({
  applied,
  onApply,
  onRemove,
  serverError,
}: {
  applied: CouponCheckResponse | null;
  onApply: (coupon: CouponCheckResponse) => void;
  onRemove: () => void;
  serverError: string | null;
}) {
  const { dict } = useI18n();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = dict.coupon;

  // Ellenőrzés a szerveren; hiba esetén a szótár szerinti üzenet
  async function apply() {
    // Üres mezővel nincs mit ellenőrizni
    if (!code.trim()) {
      return;
    }
    setBusy(true);
    setError(null);
    // Hálózati hiba esetén általános „érvénytelen” üzenet
    try {
      const response = await fetch("/api/coupons/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await response.json().catch(() => null)) as
        | (CouponCheckResponse & { errors?: Record<string, string> })
        | null;
      // Sikeres ellenőrzés
      if (response.ok && data?.code) {
        onApply({ code: data.code, amountHuf: data.amountHuf });
        setCode("");
        return;
      }
      const errorCode = data?.errors?.coupon;
      const messages: Record<string, string> = {
        couponInvalid: dict.checkout.errors.couponInvalid,
        couponNotYetValid: dict.checkout.errors.couponNotYetValid,
        couponExpired: dict.checkout.errors.couponExpired,
      };
      setError((errorCode && messages[errorCode]) || messages.couponInvalid);
    } catch {
      setError(dict.checkout.errors.couponInvalid);
    } finally {
      setBusy(false);
    }
  }

  // Beváltott kupon: kód és eltávolítás
  if (applied) {
    return (
      <div className="coupon-field">
        <span className="coupon-applied">{applied.code}</span>
        <button type="button" className="coupon-remove" onClick={onRemove}>
          {t.remove}
        </button>
      </div>
    );
  }

  return (
    <div className="coupon-field">
      <label className="checkout-field">
        <span>{t.title}</span>
        <span className="coupon-row">
          <input
            name="couponCode"
            value={code}
            placeholder={t.placeholder}
            autoComplete="off"
            onChange={(event) => setCode(event.target.value)}
            onKeyDown={(event) => {
              // Enterre beváltás, ne a teljes rendelés elküldése
              if (event.key === "Enter") {
                event.preventDefault();
                void apply();
              }
            }}
          />
          <button type="button" className="btn btn-outline-dark" disabled={busy} onClick={() => void apply()}>
            {t.apply}
          </button>
        </span>
      </label>
      {error || serverError ? <small className="checkout-error">{error ?? serverError}</small> : null}
    </div>
  );
}
