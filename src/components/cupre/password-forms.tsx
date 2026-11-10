"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FormField from "@/components/cupre/form-field";
import { useI18n } from "@/hooks/use-i18n";
import { sendJson } from "@/hooks/use-account";
import { accountError } from "@/lib/account-errors";
import { localePath } from "@/lib/i18n";

// Elfelejtett jelszó: e-mail cím megadása; a visszajelzés mindig ugyanaz (nem árulja el, létezik-e fiók)
export function ForgotPasswordForm() {
  const { lang, dict } = useI18n();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const t = dict.account;

  // Beküldés
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await sendJson("/api/account/password-reset", { email, lang });
    setBusy(false);
    // Csak korlátozás vagy hálózati hiba esetén van hibaüzenet
    if (result) {
      setError(accountError(dict, result.form));
      return;
    }
    setSent(true);
  }

  // Elküldött kérés után csak a tájékoztatás látszik
  if (sent) {
    return <p className="account-notice">{t.forgotSent}</p>;
  }

  return (
    <form className="account-form" noValidate onSubmit={handleSubmit}>
      <FormField label={t.email} name="email" type="email" autoComplete="email" value={email} onChange={setEmail} wide />
      {error ? <small className="checkout-error">{error}</small> : null}
      <button className="btn btn-copper" type="submit" disabled={busy}>
        {t.submitForgot} <span>→</span>
      </button>
      <p className="account-links">
        <Link href={localePath(lang, "/fiok/belepes")}>{t.loginTitle}</Link>
      </p>
    </form>
  );
}

// Új jelszó beállítása a levélben kapott tokennel (a token a ?token= paraméterből jön)
export function ResetPasswordForm() {
  const { lang, dict } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = dict.account;

  // Beküldés
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await sendJson("/api/account/password-reset/confirm", {
      token,
      password: pass,
      passwordConfirm: passConfirm,
    });
    setBusy(false);
    // Érvénytelen token vagy gyenge jelszó
    if (result) {
      setErrors(result);
      return;
    }
    setDone(true);
  }

  // Sikeres beállítás után belépési link
  if (done) {
    return (
      <div>
        <p className="account-notice">{t.resetDone}</p>
        <Link className="btn btn-copper" href={localePath(lang, "/fiok/belepes")}>
          {t.submitLogin} <span>→</span>
        </Link>
      </div>
    );
  }

  return (
    <form className="account-form" noValidate onSubmit={handleSubmit}>
      <FormField
        label={t.newPassword}
        name="password"
        type="password"
        autoComplete="new-password"
        value={pass}
        onChange={setPass}
        hint={t.passwordHint}
        error={accountError(dict, errors.password)}
      />
      <FormField
        label={t.passwordConfirm}
        name="passwordConfirm"
        type="password"
        autoComplete="new-password"
        value={passConfirm}
        onChange={setPassConfirm}
        error={accountError(dict, errors.passwordConfirm)}
      />
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <button className="btn btn-copper" type="submit" disabled={busy || !token}>
        {t.submitReset} <span>→</span>
      </button>
    </form>
  );
}
