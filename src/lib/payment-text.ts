import { formatPrice, interpolate, type Dictionary, type Locale } from "@/lib/i18n";
import type { PaymentSummary } from "@/types/order";

// A fizetési teendők szöveges sorai (visszaigazoló oldal és levél közösen használja):
// mód, állapot; átutalásnál számlaadatok, közlemény, határidő; utánvétnél a fizetendő összeg
export function paymentInstructionLines(dict: Dictionary, summary: PaymentSummary, lang: Locale): string[] {
  const t = dict.payment;
  // Fizetési mód nélküli rendelés: nincs teendő
  if (summary.method === "none") {
    return [];
  }
  const lines = [`${t.title}: ${t.methods[summary.method]} – ${t.statuses[summary.status]}`];
  // Átutalás: a jóváíráshoz szükséges adatok
  if (summary.method === "transfer" && summary.transfer) {
    const transfer = summary.transfer;
    lines.push(
      `${t.amount}: ${formatPrice(summary.totalHuf, lang)}`,
      `${t.accountHolder}: ${transfer.accountHolder}`,
      `${t.bankName}: ${transfer.bankName}`,
      `${t.accountNumber}: ${transfer.accountNumber}`,
      `IBAN: ${transfer.iban} · SWIFT: ${transfer.swift}`,
      `${t.reference}: ${transfer.reference}`,
      interpolate(t.due, { days: transfer.dueDays }),
    );
  } else if (summary.method === "cod") {
    lines.push(interpolate(t.codInstruction, { amount: formatPrice(summary.totalHuf, lang) }));
  }
  return lines;
}
