import { Suspense } from "react";
import AccountShell from "@/components/cupre/account-shell";
import { NewsletterTokenAction } from "@/components/cupre/newsletter-forms";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/hirlevel/megerosites">) {
  return privatePageMetadata(params, (dict) => dict.newsletter.confirmTitle);
}

// Feliratkozás megerősítése a levélben kapott tokennel; a token a query-ből jön, ezért Suspense-ben töltődik
export default async function Page({ params }: PageProps<"/[lang]/hirlevel/megerosites">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.newsletter.eyebrow} title={dict.newsletter.confirmTitle}>
      <Suspense fallback={<p className="muted">{dict.account.loading}</p>}>
        <NewsletterTokenAction action="confirm" />
      </Suspense>
    </AccountShell>
  );
}
