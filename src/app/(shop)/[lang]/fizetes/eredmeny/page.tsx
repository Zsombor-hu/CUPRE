import { Suspense } from "react";
import AccountShell from "@/components/cupre/account-shell";
import PaymentResult from "@/components/cupre/payment-result";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";
import { getCachedCompanyInfo } from "@/services/cached-data";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fizetes/eredmeny">) {
  return privatePageMetadata(params, (dict) => dict.meta.paymentTitle);
}

// Fizetési eredményoldal (ide irányít vissza a Barion); a rendelés és a token a query-ből jön, ezért Suspense-ben töltődik
export default async function PaymentResultPage({ params }: PageProps<"/[lang]/fizetes/eredmeny">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.payment.result.eyebrow} title={dict.payment.title}>
      <Suspense fallback={<p className="muted">{dict.account.loading}</p>}>
        <PaymentResult contactEmail={(await getCachedCompanyInfo()).company.email} />
      </Suspense>
    </AccountShell>
  );
}
