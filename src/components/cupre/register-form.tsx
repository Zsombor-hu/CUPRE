"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormField from "@/components/cupre/form-field";
import { useI18n } from "@/hooks/use-i18n";
import { sendJson } from "@/hooks/use-account";
import { accountError } from "@/lib/account-errors";
import { localePath } from "@/lib/i18n";

// Regisztráció vásárlás nélkül: név, e-mail, jelszó ×2, adatkezelési tájékoztató, opcionális hírlevél
export default function RegisterForm() {
  const { lang, dict } = useI18n();
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [passConfirm, setPassConfirm] = useState("");
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);
  const [newsletter, setNewsletter] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const t = dict.account;

  // Beküldés: sikeres regisztráció után a szerver be is léptet, és a „Fiókom” oldalra lépünk
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await sendJson("/api/account/register", {
      name,
      email,
      password: pass,
      passwordConfirm: passConfirm,
      acceptPrivacy,
      newsletter,
      lang,
    });
    setBusy(false);
    // Validációs hibák vagy foglalt e-mail
    if (result) {
      setErrors(result);
      return;
    }
    router.push(localePath(lang, "/fiok"));
    router.refresh();
  }

  return (
    <form className="account-form" noValidate onSubmit={handleSubmit}>
      <FormField label={t.name} name="name" autoComplete="name" value={name} onChange={setName} error={accountError(dict, errors.name)} wide />
      <FormField
        label={t.email}
        name="email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={setEmail}
        error={accountError(dict, errors.email)}
        wide
      />
      <FormField
        label={t.password}
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
      <label className="checkout-consent">
        <input type="checkbox" checked={acceptPrivacy} onChange={(event) => setAcceptPrivacy(event.target.checked)} />
        <span>
          {t.privacyBefore}
          <Link href={localePath(lang, "/adatvedelem")} target="_blank">
            {t.privacyLink}
          </Link>
          {t.privacyAfter}
        </span>
      </label>
      {errors.privacy ? <small className="checkout-error">{accountError(dict, errors.privacy)}</small> : null}
      <label className="checkout-consent">
        <input type="checkbox" checked={newsletter} onChange={(event) => setNewsletter(event.target.checked)} />
        <span>{t.newsletterOptIn}</span>
      </label>
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <button className="btn btn-copper" type="submit" disabled={busy}>
        {t.submitRegister} <span>→</span>
      </button>
      <p className="account-links">
        {t.haveAccount} <Link href={localePath(lang, "/fiok/belepes")}>{t.loginLink}</Link>
      </p>
    </form>
  );
}
