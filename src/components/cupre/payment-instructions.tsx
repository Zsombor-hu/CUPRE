"use client";

import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, interpolate } from "@/lib/i18n";
import type { PaymentSummary } from "@/types/order";

// Fizetési teendők a visszaigazoláson: átutalásnál számlaadatok, közlemény és határidő; utánvétnél a fizetendő összeg
export default function PaymentInstructions({ summary }: { summary: PaymentSummary | undefined }) {
  const { lang, dict } = useI18n();
  const t = dict.payment;
  // Fizetési mód nélküli rendelésnél nincs teendő
  if (!summary || summary.method === "none") {
    return null;
  }
  return (
    <div className="payment-instructions">
      <p>
        <strong>{t.title}:</strong> {t.methods[summary.method]} – {t.statuses[summary.status]}
      </p>
      {summary.method === "transfer" && summary.transfer ? (
        <dl>
          <div>
            <dt>{t.amount}</dt>
            <dd>{formatPrice(summary.totalHuf, lang)}</dd>
          </div>
          <div>
            <dt>{t.accountHolder}</dt>
            <dd>{summary.transfer.accountHolder}</dd>
          </div>
          <div>
            <dt>{t.bankName}</dt>
            <dd>{summary.transfer.bankName}</dd>
          </div>
          <div>
            <dt>{t.accountNumber}</dt>
            <dd>{summary.transfer.accountNumber}</dd>
          </div>
          <div>
            <dt>IBAN / SWIFT</dt>
            <dd>
              {summary.transfer.iban} / {summary.transfer.swift}
            </dd>
          </div>
          <div>
            <dt>{t.reference}</dt>
            <dd>
              <strong>{summary.transfer.reference}</strong>
            </dd>
          </div>
        </dl>
      ) : null}
      {summary.method === "transfer" && summary.transfer ? (
        <p className="muted">{interpolate(t.due, { days: summary.transfer.dueDays })}</p>
      ) : null}
      {summary.method === "cod" ? (
        <p>{interpolate(t.codInstruction, { amount: formatPrice(summary.totalHuf, lang) })}</p>
      ) : null}
    </div>
  );
}
