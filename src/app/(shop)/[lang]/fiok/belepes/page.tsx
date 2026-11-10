import AccountShell from "@/components/cupre/account-shell";
import LoginForm from "@/components/cupre/login-form";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fiok/belepes">) {
  return privatePageMetadata(params, (dict) => dict.meta.loginTitle);
}

// Belépés oldal
export default async function LoginPage({ params }: PageProps<"/[lang]/fiok/belepes">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.loginTitle} intro={dict.account.loginIntro}>
      <LoginForm />
    </AccountShell>
  );
}
