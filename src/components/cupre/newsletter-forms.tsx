"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import FormField from "@/components/cupre/form-field";
import { useI18n } from "@/hooks/use-i18n";
import { sendJson } from "@/hooks/use-account";
import { accountError } from "@/lib/account-errors";
import { localePath } from "@/lib/i18n";

// Hírlevél-feliratkozás vásárlás és fiók nélkül: név (opcionális), e-mail, kifejezett hozzájárulás
export function NewsletterSubscribeForm() {
  const { lang, dict } = useI18n();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const t = dict.newsletter;

  // Beküldés: siker esetén megerősítő levél megy ki
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const result = await sendJson("/api/newsletter/subscribe", { name, email, consent, lang });
    setBusy(false);
    // Validációs hiba
    if (result) {
      setErrors(result);
      return;
    }
    setSent(true);
  }

  // Elküldés után tájékoztatás a megerősítő levélről
  if (sent) {
    return <p className="account-notice">{t.sent}</p>;
  }

  return (
    <form className="account-form" noValidate onSubmit={handleSubmit}>
      <FormField label={t.name} name="name" autoComplete="name" value={name} onChange={setName} wide />
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
      <label className="checkout-consent">
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
          {t.consentBefore}
          <Link href={localePath(lang, "/adatvedelem")} target="_blank">
            {t.consentLink}
          </Link>
          {t.consentAfter}
        </span>
      </label>
      {errors.consent ? <small className="checkout-error">{accountError(dict, errors.consent)}</small> : null}
      {errors.form ? <small className="checkout-error">{accountError(dict, errors.form)}</small> : null}
      <button className="btn btn-copper" type="submit" disabled={busy}>
        {t.submit} <span>→</span>
      </button>
    </form>
  );
}

// Megerősítés vagy leiratkozás a levélben kapott tokennel: az oldal betöltésekor egyszer elküldi a kérést
export function NewsletterTokenAction({ action }: { action: "confirm" | "unsubscribe" }) {
  const { lang, dict } = useI18n();
  const token = useSearchParams().get("token") ?? "";
  const [state, setState] = useState<"working" | "done" | "invalid">("working");
  const started = useRef(false);
  const t = dict.newsletter;

  // A kérést csak egyszer küldjük el (fejlesztői Strict Mode-ban is)
  useEffect(() => {
    // Már elindított kérés
    if (started.current) {
      return;
    }
    started.current = true;
    // Az eredmény alapján siker vagy érvénytelen link
    void sendJson(`/api/newsletter/${action}`, { token }).then((result) => setState(result ? "invalid" : "done"));
  }, [action, token]);

  const doneText = action === "confirm" ? t.confirmed : t.unsubscribed;
  const workingText = action === "confirm" ? t.confirming : t.unsubscribing;
  return (
    <div>
      <p className="account-notice">{state === "working" ? workingText : state === "done" ? doneText : t.invalid}</p>
      {state !== "working" ? (
        <Link className="btn btn-copper" href={localePath(lang, "/")}>
          {t.backHome} <span>→</span>
        </Link>
      ) : null}
    </div>
  );
}
