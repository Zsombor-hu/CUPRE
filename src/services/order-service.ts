import "server-only";
import type { CustomerInput, OrderErrorCode, OrderRequest, OrderResponse } from "@/types/order";
import {
  initialPaymentStatus,
  newOrderAccessToken,
  paymentSummaryById,
  resolvePaymentMethod,
  startCardPayment,
} from "@/services/payment-service";
import { localePath } from "@/lib/i18n";
import { resolveShipping, shippingSummaryById } from "@/services/shipping-service";
import { validateCoupon } from "@/services/coupon-service";
import { findVariant } from "@/services/product-service";
import { createOrder, type ResolvedOrderItem } from "@/services/customer-db";
import { sendOrderConfirmation } from "@/services/mail-service";
import { subscribe } from "@/services/newsletter-service";
import { DEFAULT_LOCALE, hasLocale, type Locale } from "@/lib/i18n";
import { isValidEmail, normalizeEmail, text } from "@/lib/validation";

// Egy tételből rendelhető legnagyobb darabszám
const MAX_QTY = 99;

// Kötelező ügyfélmezők
const REQUIRED_FIELDS: (keyof CustomerInput)[] = ["name", "email", "phone", "postcode", "city", "address"];

// Validált rendelés vagy mezőnkénti hibakódok (a szövegeket a kliens a saját nyelvén jeleníti meg)
export type OrderValidation =
  | {
      ok: true;
      customer: CustomerInput;
      items: ResolvedOrderItem[];
      note: string;
      lang: Locale;
      newsletter: boolean;
    }
  | { ok: false; errors: Record<string, OrderErrorCode> };

// A POST /api/orders törzsének ellenőrzése; az árakat a szerver a products.json-ból oldja fel.
// Belépett ügyfélnél az e-mail cím mindig a fiók címe (a kliens által küldött értéket figyelmen kívül hagyjuk).
export function validateOrderRequest(body: unknown, accountEmail: string | null = null): OrderValidation {
  const errors: Record<string, OrderErrorCode> = {};
  const raw = (typeof body === "object" && body !== null ? body : {}) as Partial<OrderRequest>;
  const rawCustomer = (typeof raw.customer === "object" && raw.customer !== null ? raw.customer : {}) as Record<
    string,
    unknown
  >;
  const rawLang = text(raw.lang, 5);
  const lang: Locale = hasLocale(rawLang) ? rawLang : DEFAULT_LOCALE;

  const customer: CustomerInput = {
    name: text(rawCustomer.name),
    email: accountEmail ?? normalizeEmail(rawCustomer.email),
    phone: text(rawCustomer.phone, 40),
    postcode: text(rawCustomer.postcode, 10),
    city: text(rawCustomer.city),
    address: text(rawCustomer.address),
  };
  // Minden kötelező mező kitöltését külön jelezzük
  for (const field of REQUIRED_FIELDS) {
    // Üres mezőhöz a „kötelező” hibakódot rendeljük
    if (!customer[field]) {
      errors[field] = "required";
    }
  }
  // Kitöltött, de formailag hibás e-mail cím
  if (customer.email && !isValidEmail(customer.email)) {
    errors.email = "invalidEmail";
  }
  // Az ÁSZF elfogadása nélkül nem jöhet létre szerződés (az adatkezelés jogalapja a szerződés teljesítése)
  if (raw.acceptTerms !== true) {
    errors.terms = "termsRequired";
  }

  const items: ResolvedOrderItem[] = [];
  const rawItems = Array.isArray(raw.items) ? raw.items : [];
  // Üres kosárral nem jöhet létre rendelés
  if (rawItems.length === 0) {
    errors.items = "emptyCart";
  }
  // Tételenként ellenőrizzük a cikkszámot és a darabszámot; a tételnév az alapnyelven kerül az adatbázisba
  for (const rawItem of rawItems) {
    const sku = text(rawItem?.sku, 60);
    const qty = Number(rawItem?.qty);
    const variant = findVariant(sku, DEFAULT_LOCALE);
    // Ismeretlen cikkszám vagy érvénytelen mennyiség esetén a teljes rendelést elutasítjuk
    if (!variant || !Number.isInteger(qty) || qty < 1 || qty > MAX_QTY) {
      errors.items = "invalidItems";
      break;
    }
    items.push({ variant, qty });
  }

  // Hibák esetén nem mentünk semmit
  if (Object.keys(errors).length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, customer, items, note: text(raw.note, 1000), lang, newsletter: raw.newsletter === true };
}

// Rendelés validálása és mentése az aktuális környezet SQLite adatbázisába (a rendelés nyelvével együtt);
// belépett ügyfélnél a rendelés a fiókhoz kötődik. Kártyás fizetésnél a válasz a fizetőoldal címét is tartalmazza.
export async function placeOrder(
  body: unknown,
  account: { id: number; email: string } | null = null,
): Promise<{ ok: true; value: OrderResponse } | { ok: false; errors: Record<string, OrderErrorCode> }> {
  const validation = validateOrderRequest(body, account?.email ?? null);
  // Érvénytelen kérésnél a hibakódokat adjuk vissza
  if (!validation.ok) {
    return validation;
  }
  const payment = resolvePaymentMethod((body as Partial<OrderRequest>).paymentMethod);
  // Nem választható (kikapcsolt vagy ismeretlen) fizetési mód
  if (!payment) {
    return { ok: false, errors: { payment: "invalidPaymentMethod" } };
  }
  const request = body as Partial<OrderRequest>;
  const shipping = resolveShipping(request.shippingMethod, request.pickupPoint);
  // Nem választható szállítási mód, vagy átvételi pontos mód pont nélkül
  if (!shipping.ok) {
    return { ok: false, errors: { shipping: shipping.error } };
  }
  let discount: { couponCode: string; discountHuf: number } | null = null;
  // Megadott kupon: a szerver újra ellenőrzi (érvényesség, aktív), a levont összeget is innen veszi
  if (request.couponCode) {
    const coupon = validateCoupon(request.couponCode);
    // Érvénytelen, lejárt vagy még nem érvényes kupon
    if (!coupon.ok) {
      return { ok: false, errors: { coupon: coupon.error } };
    }
    discount = { couponCode: coupon.coupon.code, discountHuf: coupon.coupon.amountHuf };
  }
  const access = newOrderAccessToken();
  const result = createOrder(
    validation.customer,
    validation.items,
    validation.note,
    validation.lang,
    { method: shipping.method, feeHuf: shipping.feeHuf, pickupPoint: shipping.pickupPoint },
    account?.id ?? null,
    {
      method: payment.method,
      status: initialPaymentStatus(payment.method),
      feeHuf: payment.feeHuf,
      accessTokenHash: access.hash,
    },
    discount,
  );
  const summary = paymentSummaryById(result.orderId);
  const shippingSummary = shippingSummaryById(result.orderId) ?? { method: shipping.method, feeHuf: shipping.feeHuf, deliveryDays: "" };
  const resultPage = `${localePath(validation.lang, "/fizetes/eredmeny")}?order=${result.orderId}&token=${encodeURIComponent(access.token)}`;
  // A pénztárban kért hírlevél-feliratkozás külön, dupla megerősítéssel történik
  if (validation.newsletter) {
    subscribe({ email: validation.customer.email, name: validation.customer.name, lang: validation.lang, source: "checkout" });
  }
  // A visszaigazoló levél a rendelés nyelvén sorolja fel a tételeket
  sendOrderConfirmation({
    orderId: result.orderId,
    totalHuf: result.totalHuf,
    customer: validation.customer,
    lang: validation.lang,
    payment: summary,
    shipping: shippingSummary,
    discount: result.discountHuf > 0 && discount ? { couponCode: discount.couponCode, discountHuf: result.discountHuf } : null,
    items: validation.items.map((item) => ({
      variant: findVariant(item.variant.sku, validation.lang) ?? item.variant,
      qty: item.qty,
    })),
  });
  let redirectUrl: string | undefined;
  // Kártyás fizetés: a fizetőoldal címe; ha az indítás nem sikerül, az eredményoldal (onnan újrapróbálható)
  if (payment.method === "card") {
    try {
      redirectUrl = await startCardPayment(result.orderId, access.token);
    } catch (error) {
      console.error(`A(z) #${result.orderId} rendelés kártyás fizetése nem indult el:`, error);
      redirectUrl = resultPage;
    }
  }
  return {
    ok: true,
    value: {
      orderId: result.orderId,
      totalHuf: result.totalHuf,
      token: access.token,
      redirectUrl,
      payment: summary ?? { orderId: result.orderId, totalHuf: result.totalHuf, method: payment.method, status: "pending" },
      shipping: shippingSummary,
      couponCode: result.discountHuf > 0 ? discount?.couponCode : undefined,
      discountHuf: result.discountHuf,
    },
  };
}
