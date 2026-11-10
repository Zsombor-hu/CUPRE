"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FormField from "@/components/cupre/form-field";
import { useI18n } from "@/hooks/use-i18n";
import { sendJson } from "@/hooks/use-account";
import { accountError } from "@/lib/account-errors";
import { localePath } from "@/lib/i18n";

// Belépő űrlap; sikeres belépés után a „Fiókom” oldalra visz
export default function LoginForm() {
  const { lang, dict } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const t = dict.account;

  // Beküldés: a szerver dönt, hiba esetén az űrlap alatt jelenik meg (nem áruljuk el, melyik adat hibás)
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await sendJson("/api/account/login", { email, password: pass });
    setBusy(false);
    // Hibás belépés
    if (result) {
      setErrors(result);
      return;
    }
    router.push(localePath(lang, "/fiok"));
    router.refresh();
  }

  return (
    <form className="account-form" noValidate onSubmit={handleSubmit}>
      <FormField label={t.email} name="email" type="email" autoComplete="email" value={email} onChange={setEmail} wide />
      <FormField
        label={t.password}
        name="password"
        type="password"
        autoComplete="current-password"
        value={pass}
        onChange={setPass}
        wide
      />
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <button className="btn btn-copper" type="submit" disabled={busy}>
        {t.submitLogin} <span>→</span>
      </button>
      <p className="account-links">
        <Link href={localePath(lang, "/fiok/jelszo-emlekezteto")}>{t.forgot}</Link>
      </p>
      <p className="account-links">
        {t.noAccount} <Link href={localePath(lang, "/fiok/regisztracio")}>{t.registerLink}</Link>
      </p>
    </form>
  );
}
