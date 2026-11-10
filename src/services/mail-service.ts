import "server-only";
import fs from "node:fs";
import path from "node:path";
import { dataDir } from "@/services/data-paths";
import { getDictionary } from "@/services/dictionary-service";
import { getCompanyInfo } from "@/services/company-service";
import { formatPrice, interpolate, localePath, type Locale } from "@/lib/i18n";
import { paymentInstructionLines } from "@/lib/payment-text";
import { shippingLines } from "@/lib/shipping-text";
import type { CustomerInput, PaymentSummary, ShippingSummary } from "@/types/order";
import type { ResolvedOrderItem } from "@/services/customer-db";

// A visszaigazoló levélhez szükséges rendelési adatok
export type OrderConfirmation = {
  orderId: number;
  totalHuf: number;
  customer: CustomerInput;
  items: ResolvedOrderItem[];
  lang: Locale;
  // Fizetési mód és teendők (átutalásnál számlaszám, közlemény)
  payment: PaymentSummary | null;
  // Szállítási mód, díj és átvételi pont
  shipping: ShippingSummary;
  // Beváltott kupon (ha volt)
  discount: { couponCode: string; discountHuf: number } | null;
};

// Elkészített levél: címzett, tárgy és egyszerű szöveges törzs
export type MailMessage = {
  to: string;
  subject: string;
  text: string;
};

// A webshop nyilvános címe a levélben szereplő linkekhez (pl. https://cupre.hu); helyben üres, relatív linkkel
function siteUrl(): string {
  return (process.env.SITE_URL ?? "").replace(/\/$/, "");
}

// Visszaigazoló levél összeállítása a rendelés nyelvén (a jogszabály szerint haladéktalanul, elektronikusan kell küldeni)
export function buildOrderConfirmation(order: OrderConfirmation): MailMessage {
  const dict = getDictionary(order.lang);
  const company = getCompanyInfo().company;
  const lines = order.items.map(
    (item) =>
      `- ${item.variant.productName} · ${item.variant.size} · ${dict.product.grades[item.variant.grade]} · ` +
      `${interpolate(dict.cart.pieces, { qty: item.qty })} · ${formatPrice(item.variant.priceHuf * item.qty, order.lang)}`,
  );
  const text = [
    interpolate(dict.mail.greeting, { name: order.customer.name }),
    "",
    dict.mail.intro,
    "",
    `${dict.checkout.orderNumber}: #${order.orderId}`,
    ...lines,
    ...(order.discount
      ? [`${interpolate(dict.coupon.discountLine, { code: order.discount.couponCode })}: −${formatPrice(order.discount.discountHuf, order.lang)}`]
      : []),
    `${dict.mail.total}: ${formatPrice(order.totalHuf, order.lang)}`,
    "",
    `${dict.mail.address}: ${order.customer.postcode} ${order.customer.city}, ${order.customer.address}`,
    ...shippingLines(dict, order.shipping, order.lang),
    "",
    ...(order.payment ? paymentInstructionLines(dict, order.payment, order.lang) : []),
    "",
    dict.mail.legal,
    `${dict.legal.nav.aszf}: ${siteUrl()}${localePath(order.lang, "/aszf")}`,
    `${dict.legal.nav.elallas}: ${siteUrl()}${localePath(order.lang, "/elallas")}`,
    "",
    interpolate(dict.mail.footer, { email: company.email }),
    company.name,
  ].join("\n");
  return {
    to: order.customer.email,
    subject: interpolate(dict.mail.subject, { orderId: order.orderId }),
    text,
  };
}

// Levél „küldése”: amíg nincs e-mail-szolgáltató bekötve, a környezet outbox mappájába írjuk
// (src/data/<környezet>/outbox), hogy a tartalom ellenőrizhető legyen. Éles indulás előtt SMTP/API küldésre cserélendő.
export function sendMail(message: MailMessage, fileStem: string): void {
  const outbox = path.join(dataDir(), "outbox");
  fs.mkdirSync(outbox, { recursive: true });
  const content = `To: ${message.to}\nSubject: ${message.subject}\n\n${message.text}\n`;
  fs.writeFileSync(path.join(outbox, `${new Date().toISOString().replace(/[:.]/g, "-")}-${fileStem}.txt`), content, "utf-8");
}

// Abszolút (vagy SITE_URL nélkül relatív) link a webshop egy oldalára, a nyelvnek megfelelő előtaggal
function pageUrl(lang: Locale, path: string, token?: string): string {
  const query = token ? `?token=${encodeURIComponent(token)}` : "";
  return `${siteUrl()}${localePath(lang, path)}${query}`;
}

// Levélküldés hibatűréssel: a hiba nem akadályozhatja a felhasználói műveletet, csak naplózzuk
function sendSafely(build: () => MailMessage, fileStem: string): void {
  // A levél elkészítése vagy írása közbeni hiba ne szakítsa meg a kérést
  try {
    sendMail(build(), fileStem);
  } catch (error) {
    console.error(`A levél (${fileStem}) nem készült el:`, error);
  }
}

// Hírlevél-feliratkozás megerősítő levele (dupla opt-in): megerősítő és leiratkozó link ugyanazzal a tokennel
export function sendNewsletterConfirmation(input: { email: string; name: string; lang: Locale; token: string }): void {
  sendSafely(() => {
    const dict = getDictionary(input.lang);
    const company = getCompanyInfo().company;
    return {
      to: input.email,
      subject: dict.mail.newsletterSubject,
      text: [
        input.name ? interpolate(dict.mail.greeting, { name: input.name }) : dict.mail.greetingAnonymous,
        "",
        dict.mail.newsletterIntro,
        "",
        `${dict.mail.newsletterConfirm}: ${pageUrl(input.lang, "/hirlevel/megerosites", input.token)}`,
        "",
        dict.mail.newsletterIgnore,
        `${dict.mail.newsletterUnsubscribe}: ${pageUrl(input.lang, "/hirlevel/leiratkozas", input.token)}`,
        "",
        interpolate(dict.mail.footer, { email: company.email }),
        company.name,
      ].join("\n"),
    };
  }, "newsletter-confirm");
}

// „Fizetés beérkezett” levél sikeres kártyás fizetés után
export function sendPaymentReceived(input: {
  orderId: number;
  totalHuf: number;
  email: string;
  name: string;
  lang: Locale;
}): void {
  sendSafely(() => {
    const dict = getDictionary(input.lang);
    const company = getCompanyInfo().company;
    return {
      to: input.email,
      subject: interpolate(dict.mail.paymentReceivedSubject, { orderId: input.orderId }),
      text: [
        interpolate(dict.mail.greeting, { name: input.name }),
        "",
        interpolate(dict.mail.paymentReceivedIntro, {
          orderId: input.orderId,
          amount: formatPrice(input.totalHuf, input.lang),
        }),
        "",
        interpolate(dict.mail.footer, { email: company.email }),
        company.name,
      ].join("\n"),
    };
  }, `payment-${input.orderId}`);
}

// „Feladtuk a csomagodat” levél, amikor az admin a rendelést „feladva” állapotba teszi (szállítási mód, átvételi pont,
// opcionálisan az admin megjegyzése, pl. csomagkövetési szám)
export function sendOrderShipped(input: {
  orderId: number;
  email: string;
  name: string;
  lang: Locale;
  shipping: ShippingSummary;
  note: string;
}): void {
  sendSafely(() => {
    const dict = getDictionary(input.lang);
    const company = getCompanyInfo().company;
    return {
      to: input.email,
      subject: interpolate(dict.mail.shippedSubject, { orderId: input.orderId }),
      text: [
        interpolate(dict.mail.greeting, { name: input.name }),
        "",
        interpolate(dict.mail.shippedIntro, { orderId: input.orderId }),
        "",
        ...shippingLines(dict, input.shipping, input.lang),
        ...(input.note ? ["", `${dict.mail.shippedNote}: ${input.note}`] : []),
        "",
        interpolate(dict.mail.footer, { email: company.email }),
        company.name,
      ].join("\n"),
    };
  }, `shipped-${input.orderId}`);
}

// Jelszó-visszaállító levél (1 órás, egyszer használható link)
export function sendPasswordReset(input: { email: string; name: string; lang: Locale; token: string }): void {
  sendSafely(() => {
    const dict = getDictionary(input.lang);
    const company = getCompanyInfo().company;
    return {
      to: input.email,
      subject: dict.mail.resetSubject,
      text: [
        interpolate(dict.mail.greeting, { name: input.name }),
        "",
        dict.mail.resetIntro,
        "",
        `${dict.mail.resetLink}: ${pageUrl(input.lang, "/fiok/uj-jelszo", input.token)}`,
        "",
        dict.mail.resetIgnore,
        "",
        interpolate(dict.mail.footer, { email: company.email }),
        company.name,
      ].join("\n"),
    };
  }, "password-reset");
}

// Rendelés-visszaigazolás küldése; hiba esetén csak naplózunk, a már mentett rendelést nem érvénytelenítjük
export function sendOrderConfirmation(order: OrderConfirmation): void {
  // A levélküldés hibája nem akadályozhatja a rendelés visszaigazolását a felületen
  try {
    sendMail(buildOrderConfirmation(order), `order-${order.orderId}`);
  } catch (error) {
    console.error(`A(z) #${order.orderId} rendelés visszaigazoló levele nem készült el:`, error);
  }
}
