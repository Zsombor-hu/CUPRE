import { Suspense } from "react";
import AccountShell from "@/components/cupre/account-shell";
import { ResetPasswordForm } from "@/components/cupre/password-forms";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fiok/uj-jelszo">) {
  return privatePageMetadata(params, (dict) => dict.meta.passwordTitle);
}

// Új jelszó beállítása; a token a query-ből jön, ezért az űrlap Suspense-ben töltődik
export default async function ResetPasswordPage({ params }: PageProps<"/[lang]/fiok/uj-jelszo">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.resetTitle}>
      <Suspense fallback={<p className="muted">{dict.account.loading}</p>}>
        <ResetPasswordForm />
      </Suspense>
    </AccountShell>
  );
}
