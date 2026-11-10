import AccountShell from "@/components/cupre/account-shell";
import RegisterForm from "@/components/cupre/register-form";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fiok/regisztracio">) {
  return privatePageMetadata(params, (dict) => dict.meta.registerTitle);
}

// Regisztráció oldal (vásárlás nélkül is)
export default async function RegisterPage({ params }: PageProps<"/[lang]/fiok/regisztracio">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.account.eyebrow} title={dict.account.registerTitle} intro={dict.account.registerIntro}>
      <RegisterForm />
    </AccountShell>
  );
}
