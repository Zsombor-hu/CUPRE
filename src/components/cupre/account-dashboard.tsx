"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import AccountShell from "@/components/cupre/account-shell";
import FormField from "@/components/cupre/form-field";
import { useI18n } from "@/hooks/use-i18n";
import { sendJson, useAccount } from "@/hooks/use-account";
import { accountError } from "@/lib/account-errors";
import { formatDate, formatPrice, interpolate, localePath } from "@/lib/i18n";
import type { AccountOverview, AccountProfileInput } from "@/types/account";

// A profil szerkeszthető mezői a megjelenítés sorrendjében
const PROFILE_FIELDS: { name: keyof AccountProfileInput; autoComplete: string; type: string; wide?: boolean }[] = [
  { name: "name", autoComplete: "name", type: "text", wide: true },
  { name: "phone", autoComplete: "tel", type: "tel" },
  { name: "postcode", autoComplete: "postal-code", type: "text" },
  { name: "city", autoComplete: "address-level2", type: "text" },
  { name: "address", autoComplete: "street-address", type: "text", wide: true },
];

// Profil (szállítási adatok) szerkesztése
function ProfileSection({ overview, onSaved }: { overview: AccountOverview; onSaved: () => Promise<void> }) {
  const { lang, dict } = useI18n();
  const [form, setForm] = useState<AccountProfileInput>({
    name: overview.profile.name,
    phone: overview.profile.phone,
    postcode: overview.profile.postcode,
    city: overview.profile.city,
    address: overview.profile.address,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const labels: Record<keyof AccountProfileInput, string> = { ...dict.checkout.fields, name: dict.account.name };

  // Mentés: a profil adatai és a fiók nyelve (az aktuális oldal nyelve)
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const result = await sendJson("/api/account/me", { ...form, lang }, "PATCH");
    // Validációs hiba
    if (result) {
      setErrors(result);
      return;
    }
    setErrors({});
    setSaved(true);
    await onSaved();
  }

  return (
    <form className="account-panel" noValidate onSubmit={handleSubmit}>
      <h2>{dict.account.profileTitle}</h2>
      <p className="muted">{dict.account.profileIntro}</p>
      <div className="checkout-field-grid">
        <FormField label={dict.account.email} name="email" type="email" value={overview.profile.email} onChange={() => undefined} readOnly wide />
        {PROFILE_FIELDS.map((field) => (
          <FormField
            key={field.name}
            label={labels[field.name]}
            name={field.name}
            type={field.type}
            autoComplete={field.autoComplete}
            value={form[field.name]}
            onChange={(value) => setForm((current) => ({ ...current, [field.name]: value }))}
            error={accountError(dict, errors[field.name])}
            wide={field.wide}
          />
        ))}
      </div>
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <div className="account-actions">
        <button className="btn btn-copper" type="submit">
          {dict.account.save}
        </button>
        {saved ? <span className="account-saved">{dict.account.saved}</span> : null}
      </div>
    </form>
  );
}

// Hírlevél állapota és be/ki kapcsolása (bekapcsoláskor megerősítő levél megy ki)
function NewsletterSection({ overview, onSaved }: { overview: AccountOverview; onSaved: () => Promise<void> }) {
  const { lang, dict } = useI18n();
  const status = overview.profile.newsletter;
  const subscribed = status === "active" || status === "pending";

  // Váltás: a profil változatlan adataival együtt küldjük a hírlevél-beállítást
  async function toggle() {
    const { name, phone, postcode, city, address } = overview.profile;
    await sendJson("/api/account/me", { name, phone, postcode, city, address, lang, newsletter: !subscribed }, "PATCH");
    await onSaved();
  }

  return (
    <div className="account-panel">
      <h2>{dict.account.newsletterTitle}</h2>
      <p>{dict.account.newsletterStatus[status ?? "none"]}</p>
      <button className="btn btn-outline-dark" type="button" onClick={toggle}>
        {subscribed ? dict.account.newsletterOff : dict.account.newsletterOn}
      </button>
    </div>
  );
}

// Korábbi rendelések listája
function OrdersSection({ overview }: { overview: AccountOverview }) {
  const { lang, dict } = useI18n();
  return (
    <div className="account-panel">
      <h2>{dict.account.ordersTitle}</h2>
      {overview.orders.length === 0 ? <p className="muted">{dict.account.noOrders}</p> : null}
      {overview.orders.map((order) => (
        <div className="account-order" key={order.id}>
          <div className="account-order-head">
            <strong>{interpolate(dict.account.orderLabel, { id: order.id, date: formatDate(order.createdAt, lang) })}</strong>
            <span>{formatPrice(order.totalHuf, lang)}</span>
          </div>
          <small>{(dict.orderStatuses as Record<string, string>)[order.status] ?? order.status}</small>
          {order.shippingMethod !== "none" ? (
            <small>
              {dict.shipping.methods[order.shippingMethod]}
              {order.pickupPointName ? ` – ${order.pickupPointName}` : ""}
            </small>
          ) : null}
          {order.paymentMethod !== "none" ? (
            <small>
              {dict.payment.methods[order.paymentMethod]} – {dict.payment.statuses[order.paymentStatus]}
            </small>
          ) : null}
          {order.items.map((item, index) => (
            <small key={`${order.id}-${index}`}>
              {item.productName} · {item.size} · {dict.product.grades[item.grade]} ·{" "}
              {interpolate(dict.cart.pieces, { qty: item.qty })}
            </small>
          ))}
        </div>
      ))}
    </div>
  );
}

// Jelszócsere (a jelenlegi jelszó ellenőrzésével)
function PasswordSection() {
  const { dict } = useI18n();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);
  const t = dict.account;

  // Beküldés
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaved(false);
    const result = await sendJson("/api/account/password", {
      currentPassword: current,
      password: next,
      passwordConfirm: confirm,
    });
    // Hibás jelenlegi jelszó vagy gyenge új jelszó
    if (result) {
      setErrors(result);
      return;
    }
    setErrors({});
    setCurrent("");
    setNext("");
    setConfirm("");
    setSaved(true);
  }

  return (
    <form className="account-panel" noValidate onSubmit={handleSubmit}>
      <h2>{t.passwordTitle}</h2>
      <div className="checkout-field-grid">
        <FormField
          label={t.currentPassword}
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          value={current}
          onChange={setCurrent}
          error={accountError(dict, errors.currentPassword)}
          wide
        />
        <FormField
          label={t.newPassword}
          name="password"
          type="password"
          autoComplete="new-password"
          value={next}
          onChange={setNext}
          hint={t.passwordHint}
          error={accountError(dict, errors.password)}
        />
        <FormField
          label={t.passwordConfirm}
          name="passwordConfirm"
          type="password"
          autoComplete="new-password"
          value={confirm}
          onChange={setConfirm}
          error={accountError(dict, errors.passwordConfirm)}
        />
      </div>
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <div className="account-actions">
        <button className="btn btn-outline-dark" type="submit">
          {t.save}
        </button>
        {saved ? <span className="account-saved">{t.passwordSaved}</span> : null}
      </div>
    </form>
  );
}

// Fiók törlése jelszóval és megerősítő kérdéssel
function DeleteSection({ onDeleted }: { onDeleted: () => void }) {
  const { dict } = useI18n();
  const [pass, setPass] = useState("");
  const [error, setError] = useState<string | null>(null);
  const t = dict.account;

  // Törlés: böngészős megerősítés után a szerver a jelszót is ellenőrzi
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Mégsem: nincs teendő
    if (!window.confirm(t.deleteConfirm)) {
      return;
    }
    const result = await sendJson("/api/account/delete", { password: pass });
    // Hibás jelszó
    if (result) {
      setError(accountError(dict, result.password ?? result.form));
      return;
    }
    onDeleted();
  }

  return (
    <form className="account-panel account-danger" noValidate onSubmit={handleSubmit}>
      <h2>{t.deleteTitle}</h2>
      <p className="muted">{t.deleteText}</p>
      <FormField
        label={t.password}
        name="deletePassword"
        type="password"
        autoComplete="current-password"
        value={pass}
        onChange={setPass}
        error={error}
        wide
      />
      <button className="btn btn-outline-dark" type="submit">
        {t.deleteButton}
      </button>
    </form>
  );
}

// „Fiókom” oldal: profil, hírlevél, rendelések, jelszócsere, kilépés, fióktörlés; belépés nélkül a belépő oldalra visz
export default function AccountDashboard() {
  const { lang, dict } = useI18n();
  const router = useRouter();
  const { state, reload } = useAccount();
  const [deleted, setDeleted] = useState(false);

  // Belépés nélkül (és nem frissen törölt fióknál) átirányítás a belépésre
  useEffect(() => {
    // Csak a betöltés után, vendég állapotban irányítunk át
    if (state.status === "guest" && !deleted) {
      router.replace(localePath(lang, "/fiok/belepes"));
    }
  }, [state.status, deleted, lang, router]);

  // Kilépés után a főoldalra
  async function logout() {
    await sendJson("/api/account/logout", {});
    router.push(localePath(lang, "/"));
    router.refresh();
  }

  // Sikeres fióktörlés után visszajelzés
  if (deleted) {
    return (
      <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.deleteTitle}>
        <p className="account-notice">{dict.account.deleted}</p>
        <Link className="btn btn-copper" href={localePath(lang, "/")}>
          {dict.newsletter.backHome} <span>→</span>
        </Link>
      </AccountShell>
    );
  }

  // Betöltés vagy átirányítás közben
  if (state.status !== "user") {
    return (
      <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.dashboardTitle}>
        <p className="muted">{state.status === "loading" ? dict.account.loading : dict.account.loginRequired}</p>
      </AccountShell>
    );
  }

  const { overview } = state;
  return (
    <AccountShell
      eyebrow={dict.account.eyebrow}
      title={interpolate(dict.account.hello, { name: overview.profile.name })}
      intro={interpolate(dict.account.memberSince, { date: formatDate(overview.profile.createdAt, lang) })}
      wide
    >
      <div className="account-grid">
        <ProfileSection overview={overview} onSaved={reload} />
        <div className="account-column">
          <NewsletterSection overview={overview} onSaved={reload} />
          <OrdersSection overview={overview} />
        </div>
        <PasswordSection />
        <DeleteSection onDeleted={() => setDeleted(true)} />
      </div>
      <div className="account-actions">
        <button className="btn btn-outline-dark" type="button" onClick={logout}>
          {dict.account.logout}
        </button>
      </div>
    </AccountShell>
  );
}
