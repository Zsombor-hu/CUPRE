import AccountDashboard from "@/components/cupre/account-dashboard";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fiok">) {
  return privatePageMetadata(params, (dict) => dict.meta.accountTitle);
}

// „Fiókom” oldal: a tartalmat a kliens tölti be a munkamenet-süti alapján
export default async function AccountPage({ params }: PageProps<"/[lang]/fiok">) {
  await resolvePageLang(params);
  return <AccountDashboard />;
}
