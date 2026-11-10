import { Suspense } from "react";
import AccountShell from "@/components/cupre/account-shell";
import MockPayment from "@/components/cupre/mock-payment";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/fizetes/teszt">) {
  return privatePageMetadata(params, (dict) => dict.payment.mock.title);
}

// Teszt fizetőoldal (csak fejlesztéshez – a mögötte lévő API production környezetben 403-at ad)
export default async function MockPaymentPage({ params }: PageProps<"/[lang]/fizetes/teszt">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.payment.mock.eyebrow} title={dict.payment.mock.title}>
      <Suspense fallback={<p className="muted">{dict.account.loading}</p>}>
        <MockPayment />
      </Suspense>
    </AccountShell>
  );
}
