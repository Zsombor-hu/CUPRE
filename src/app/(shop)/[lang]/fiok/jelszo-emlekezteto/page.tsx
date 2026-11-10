import AccountShell from "@/components/cupre/account-shell";
import { ForgotPasswordForm } from "@/components/cupre/password-forms";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fiok/jelszo-emlekezteto">) {
  return privatePageMetadata(params, (dict) => dict.meta.passwordTitle);
}

// Elfelejtett jelszó oldal
export default async function ForgotPasswordPage({ params }: PageProps<"/[lang]/fiok/jelszo-emlekezteto">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.forgotTitle} intro={dict.account.forgotIntro}>
      <ForgotPasswordForm />
    </AccountShell>
  );
}
