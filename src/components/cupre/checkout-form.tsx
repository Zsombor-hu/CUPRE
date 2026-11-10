"use client";

import { useEffect, useState } from "react";
import { useAccount } from "@/hooks/use-account";
import Link from "next/link";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, interpolate, localePath, type Dictionary } from "@/lib/i18n";
import PaymentInstructions from "@/components/cupre/payment-instructions";
import PickupPointPicker from "@/components/cupre/pickup-point-picker";
import ShippingInfo from "@/components/cupre/shipping-info";
import CouponField from "@/components/cupre/coupon-field";
import type { CouponCheckResponse } from "@/types/coupon";
import type {
  PickupPoint,
  ShippingMethod,
  PaymentMethod,
  CheckoutSettings,
  CustomerInput,
  OrderErrorCode,
  OrderErrorResponse,
  OrderRequest,
  OrderResponse,
} from "@/types/order";

// Az űrlap mezői a megjelenítés sorrendjében (a feliratok a szótár checkout.fields részéből jönnek)
const FIELDS: { name: keyof CustomerInput; type: string; autoComplete: string; wide?: boolean }[] = [
  { name: "name", type: "text", autoComplete: "name", wide: true },
  { name: "email", type: "email", autoComplete: "email" },
  { name: "phone", type: "tel", autoComplete: "tel" },
  { name: "postcode", type: "text", autoComplete: "postal-code" },
  { name: "city", type: "text", autoComplete: "address-level2" },
  { name: "address", type: "text", autoComplete: "street-address", wide: true },
];

// Kliensoldali hibakód: a szerver kódjai, plusz a hálózati hiba
type FormErrorCode = OrderErrorCode | "network";

// Egy mező hibájának eltávolítása (a többi hiba megmarad)
function withoutError(errors: Record<string, FormErrorCode>, field: string): Record<string, FormErrorCode> {
  const next = { ...errors };
  delete next[field];
  return next;
}

// Hibakód → megjelenítendő szöveg az aktuális nyelven; a „kötelező” üzenet mezőnként eltér
function errorMessage(dict: Dictionary, field: string, code: FormErrorCode | undefined): string | null {
  // Nincs hiba ennél a mezőnél
  if (!code) {
    return null;
  }
  // Kötelező mező: mezőspecifikus szöveg
  if (code === "required" && field in dict.checkout.errors.required) {
    return dict.checkout.errors.required[field as keyof CustomerInput];
  }
  return code === "required" ? dict.checkout.errors.invalidRequest : dict.checkout.errors[code];
}

const EMPTY_CUSTOMER: CustomerInput = { name: "", email: "", phone: "", postcode: "", city: "", address: "" };

// Pénztár űrlap: ügyféladatok, ÁSZF-elfogadás és rendelés összesítő; a rendelést a /api/orders menti a környezet
// SQLite adatbázisába. Éles módban (company.json shop.liveOrders) a gomb „fizetési kötelezettséggel” feliratú.
export default function CheckoutForm({ settings }: { settings: CheckoutSettings }) {
  const { lines, cartTotalHuf, clearCart } = useShop();
  const { lang, dict } = useI18n();
  const [customer, setCustomer] = useState<CustomerInput>(EMPTY_CUSTOMER);
  const [note, setNote] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [errors, setErrors] = useState<Record<string, FormErrorCode>>({});
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState<OrderResponse | null>(null);
  const { state: account } = useAccount();
  const [prefilled, setPrefilled] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(settings.paymentOptions[0]?.method ?? "none");
  const [redirecting, setRedirecting] = useState(false);
  const selectedOption = settings.paymentOptions.find((option) => option.method === paymentMethod);
  const [shippingMethod, setShippingMethod] = useState<ShippingMethod>(settings.shippingOptions[0]?.method ?? "none");
  const [pickupPoint, setPickupPoint] = useState<PickupPoint | null>(null);
  const [coupon, setCoupon] = useState<CouponCheckResponse | null>(null);
  const selectedShipping = settings.shippingOptions.find((option) => option.method === shippingMethod);
  const t = dict.checkout;
  const accountEmail = account.status === "user" ? account.overview.profile.email : null;

  // Belépett ügyfélnél egyszer előtöltjük a szállítási adatokat a profilból (a már beírt mezőket nem írjuk felül)
  useEffect(() => {
    // Csak belépett ügyfélnél és csak egyszer
    if (account.status !== "user" || prefilled) {
      return;
    }
    const { profile } = account.overview;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a profil csak a kliensoldali lekérdezés után ismert
    setCustomer((current) => ({
      name: current.name || profile.name,
      email: profile.email,
      phone: current.phone || profile.phone,
      postcode: current.postcode || profile.postcode,
      city: current.city || profile.city,
      address: current.address || profile.address,
    }));
    setPrefilled(true);
  }, [account, prefilled]);

  // Mező módosítása; a mező hibaüzenete gépeléskor eltűnik
  function updateField(field: keyof CustomerInput, value: string) {
    setCustomer((current) => ({ ...current, [field]: value }));
    setErrors((current) => withoutError(current, field));
  }

  // Beküldés: a kosár cikkszámait és mennyiségeit küldjük, az árat a szerver számolja újra
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    const payload: OrderRequest = {
      customer,
      items: lines.map((line) => ({ sku: line.sku, qty: line.qty })),
      note,
      acceptTerms,
      newsletter,
      paymentMethod,
      couponCode: coupon?.code,
      shippingMethod,
      pickupPoint: selectedShipping?.picker ? (pickupPoint ?? undefined) : undefined,
      lang,
    };
    // Hálózati hiba esetén általános üzenetet mutatunk, az űrlap adatai megmaradnak
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      // Sikeres mentés: visszaigazolás és a kosár ürítése
      if (response.ok) {
        const result = (await response.json()) as OrderResponse;
        clearCart();
        // Kártyás fizetés: átirányítás a fizetőoldalra (Barion vagy fejlesztéskor a teszt-oldal)
        if (result.redirectUrl) {
          setRedirecting(true);
          window.location.assign(result.redirectUrl);
          return;
        }
        setConfirmation(result);
        return;
      }
      const failed = ((await response.json()) as OrderErrorResponse).errors;
      setErrors(failed);
      // A kupon közben érvénytelenné vált (pl. lejárt): eltávolítjuk, hogy a hibaüzenet a mezőnél látszódjon
      if (failed.coupon) {
        setCoupon(null);
      }
    } catch {
      setErrors({ form: "network" });
    } finally {
      setSubmitting(false);
    }
  }

  // Sikeres rendelés után csak a visszaigazolás látszik
  if (confirmation) {
    return (
      <div className="checkout-confirmation">
        <div className="eyebrow">{t.thanksEyebrow}</div>
        <h2>{t.thanksTitle}</h2>
        <p>
          {t.orderNumber}: <strong>#{confirmation.orderId}</strong> · {t.total}:{" "}
          <strong>{formatPrice(confirmation.totalHuf, lang)}</strong>
        </p>
        <ShippingInfo summary={confirmation.shipping} />
        <PaymentInstructions summary={confirmation.payment} />
        <p className="muted">{t.thanksText}</p>
        <Link className="btn btn-copper" href={localePath(lang, "/termekek")}>
          {t.backToProducts} <span>→</span>
        </Link>
      </div>
    );
  }

  // Átirányítás közben (a kosár már üres, de még nem az üres-kosár nézetet mutatjuk)
  if (redirecting) {
    return (
      <div className="checkout-confirmation">
        <p className="account-notice">{dict.payment.redirecting}</p>
      </div>
    );
  }

  // Üres kosárnál nincs mit megrendelni
  if (lines.length === 0) {
    return (
      <div className="checkout-confirmation">
        <h2>{t.emptyTitle}</h2>
        <p>{t.emptyText}</p>
        <Link className="btn btn-copper" href={localePath(lang, "/termekek")}>
          {t.viewProducts} <span>→</span>
        </Link>
      </div>
    );
  }

  const itemsError = errorMessage(dict, "items", errors.items);
  const formError = errorMessage(dict, "form", errors.form);
  const termsError = errorMessage(dict, "terms", errors.terms);
  const legal = dict.checkoutLegal;
  const paymentFee = selectedOption?.feeHuf ?? 0;
  const shippingFee = selectedShipping?.feeHuf ?? 0;
  // A kupon csak a termékek árából vonható le, legfeljebb annak összegéig (a szerver ugyanígy számol)
  const discount = coupon ? Math.min(coupon.amountHuf, cartTotalHuf) : 0;
  const totalWithShipping = cartTotalHuf - discount + shippingFee + paymentFee;
  const couponError = errorMessage(dict, "coupon", errors.coupon);
  const shippingError = errorMessage(dict, "shipping", errors.shipping);
  const paymentError = errorMessage(dict, "payment", errors.payment);

  return (
    <form className="checkout-grid" noValidate onSubmit={handleSubmit}>
      <div className="checkout-fields">
        <h2>{t.shipping}</h2>
        {selectedShipping?.picker ? <p className="checkout-account">{dict.shipping.billingAddressNote}</p> : null}
        {accountEmail ? (
          <p className="checkout-account">{interpolate(dict.checkoutAccount.loggedInAs, { email: accountEmail })}</p>
        ) : account.status === "guest" ? (
          <p className="checkout-account">
            {dict.checkoutAccount.loginPrompt}{" "}
            <Link href={localePath(lang, "/fiok/belepes")}>{dict.checkoutAccount.loginLink}</Link>
            {dict.checkoutAccount.loginSuffix}
          </p>
        ) : null}
        <div className="checkout-field-grid">
          {FIELDS.map((field) => {
            const message = errorMessage(dict, field.name, errors[field.name]);
            return (
              <label key={field.name} className={field.wide ? "checkout-field wide" : "checkout-field"}>
                <span>{t.fields[field.name]}</span>
                <input
                  name={field.name}
                  type={field.type}
                  autoComplete={field.autoComplete}
                  value={customer[field.name]}
                  readOnly={field.name === "email" && accountEmail !== null}
                  aria-invalid={Boolean(message)}
                  onChange={(event) => updateField(field.name, event.target.value)}
                />
                {message ? <small className="checkout-error">{message}</small> : null}
              </label>
            );
          })}
          <label className="checkout-field wide">
            <span>{t.note}</span>
            <textarea name="note" rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
        </div>
        {settings.shippingOptions.length > 0 ? (
          <fieldset className="payment-options">
            <legend>{dict.shipping.title}</legend>
            {settings.shippingOptions.map((option) => (
              <label
                key={option.method}
                className={option.method === shippingMethod ? "payment-option selected" : "payment-option"}
              >
                <input
                  type="radio"
                  name="shippingMethod"
                  value={option.method}
                  checked={option.method === shippingMethod}
                  onChange={() => {
                    setShippingMethod(option.method);
                    setPickupPoint(null);
                    setErrors((current) => withoutError(current, "shipping"));
                  }}
                />
                <span className="payment-option-body">
                  <strong>
                    {dict.shipping.methods[option.method]}
                    <span className="payment-fee">{formatPrice(option.feeHuf, lang)}</span>
                  </strong>
                  <small>
                    {option.carrierName ? `${option.carrierName} · ` : ""}
                    {interpolate(dict.shipping.deliveryDays, { days: option.deliveryDays })}
                    {" · "}
                    {dict.shipping.descriptions[option.method]}
                  </small>
                </span>
              </label>
            ))}
            {selectedShipping?.picker ? (
              <PickupPointPicker
                option={selectedShipping}
                value={pickupPoint}
                error={shippingError}
                onChange={(point) => {
                  setPickupPoint(point);
                  setErrors((current) => withoutError(current, "shipping"));
                }}
              />
            ) : shippingError ? (
              <small className="checkout-error">{shippingError}</small>
            ) : null}
          </fieldset>
        ) : null}
        {settings.paymentOptions.length > 0 ? (
          <fieldset className="payment-options">
            <legend>{dict.payment.title}</legend>
            {settings.paymentOptions.map((option) => (
              <label
                key={option.method}
                className={option.method === paymentMethod ? "payment-option selected" : "payment-option"}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value={option.method}
                  checked={option.method === paymentMethod}
                  onChange={() => {
                    setPaymentMethod(option.method);
                    setErrors((current) => withoutError(current, "payment"));
                  }}
                />
                <span className="payment-option-body">
                  <strong>
                    {dict.payment.methods[option.method]}
                    {option.method === "card" && option.provider === "barion" ? (
                      <span className="payment-badge">Barion</span>
                    ) : null}
                    {option.method === "card" && option.provider === "mock" ? (
                      <span className="payment-badge test">TESZT</span>
                    ) : null}
                    {option.feeHuf > 0 ? (
                      <span className="payment-fee">
                        {interpolate(dict.payment.fee, { fee: formatPrice(option.feeHuf, lang) })}
                      </span>
                    ) : null}
                  </strong>
                  <small>
                    {option.method === "card" && option.provider === "mock"
                      ? dict.payment.descriptions.cardMock
                      : dict.payment.descriptions[option.method]}
                  </small>
                </span>
              </label>
            ))}
            {paymentMethod === "card" ? <p className="payment-notice">{dict.payment.barionNotice}</p> : null}
            {paymentError ? <small className="checkout-error">{paymentError}</small> : null}
          </fieldset>
        ) : null}
        <label className="checkout-consent">
          <input
            type="checkbox"
            name="acceptTerms"
            checked={acceptTerms}
            aria-invalid={Boolean(termsError)}
            onChange={(event) => {
              setAcceptTerms(event.target.checked);
              setErrors((current) => withoutError(current, "terms"));
            }}
          />
          <span>
            {legal.termsBefore}
            <Link href={localePath(lang, "/aszf")} target="_blank">
              {legal.termsLink}
            </Link>
            {legal.termsAfter}
            <Link href={localePath(lang, "/elallas")} target="_blank">
              {legal.withdrawalLink}
            </Link>
            {legal.termsEnd}
          </span>
        </label>
        {termsError ? <small className="checkout-error">{termsError}</small> : null}
        <p className="checkout-privacy">
          {legal.privacyBefore}
          <Link href={localePath(lang, "/adatvedelem")} target="_blank">
            {legal.privacyLink}
          </Link>
          {legal.privacyAfter}
        </p>
        <label className="checkout-consent">
          <input type="checkbox" name="newsletter" checked={newsletter} onChange={(event) => setNewsletter(event.target.checked)} />
          <span>{dict.checkoutAccount.newsletterOptIn}</span>
        </label>
      </div>

      <aside className="checkout-summary">
        <h2>{t.summary}</h2>
        {lines.map((line) => (
          <div className="checkout-line" key={line.sku}>
            <div>
              <strong>{line.variant.productName}</strong>
              <small>
                {line.variant.size} · {dict.product.grades[line.variant.grade]} ·{" "}
                {interpolate(dict.cart.pieces, { qty: line.qty })}
              </small>
            </div>
            <span>{formatPrice(line.lineTotalHuf, lang)}</span>
          </div>
        ))}
        <div className="checkout-line">
          <div>
            <strong>{legal.shipping}</strong>
          </div>
          <span>
            {selectedShipping ? formatPrice(shippingFee, lang) : legal.shippingPending}
          </span>
        </div>
        {paymentFee > 0 ? (
          <div className="checkout-line">
            <div>
              <strong>{dict.payment.codFee}</strong>
            </div>
            <span>{formatPrice(paymentFee, lang)}</span>
          </div>
        ) : null}
        {coupon ? (
          <div className="checkout-line">
            <div>
              <strong>{interpolate(dict.coupon.discountLine, { code: coupon.code })}</strong>
            </div>
            <span>−{formatPrice(discount, lang)}</span>
          </div>
        ) : null}
        <CouponField
          applied={coupon}
          serverError={couponError}
          onApply={(applied) => {
            setCoupon(applied);
            setErrors((current) => withoutError(current, "coupon"));
          }}
          onRemove={() => setCoupon(null)}
        />
        <div className="checkout-total">
          <span>{t.total}</span>
          <strong>{formatPrice(totalWithShipping, lang)}</strong>
        </div>
        <p className="muted">{dict.productInfo.grossNote}</p>
        {itemsError ? <small className="checkout-error">{itemsError}</small> : null}
        {formError ? <small className="checkout-error">{formError}</small> : null}
        <button className="btn btn-copper" type="submit" disabled={submitting}>
          {submitting
            ? t.submitting
            : settings.liveOrders
              ? legal.submitLive
              : paymentMethod === "card"
                ? dict.payment.submitCard
                : t.submit}{" "}
          <span>→</span>
        </button>
        {settings.liveOrders || settings.paymentOptions.length > 0 ? null : <p className="muted">{t.paymentInactive}</p>}
      </aside>
    </form>
  );
}
