import { Suspense } from "react";
import AccountShell from "@/components/cupre/account-shell";
import { NewsletterTokenAction } from "@/components/cupre/newsletter-forms";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím (nem indexelt)
export async function generateMetadata({ params }: PageProps<"/[lang]/hirlevel/leiratkozas">) {
  return privatePageMetadata(params, (dict) => dict.newsletter.unsubscribeTitle);
}

// Leiratkozás a hírlevélről a levélben kapott tokennel; a token a query-ből jön, ezért Suspense-ben töltődik
export default async function Page({ params }: PageProps<"/[lang]/hirlevel/leiratkozas">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.newsletter.eyebrow} title={dict.newsletter.unsubscribeTitle}>
      <Suspense fallback={<p className="muted">{dict.account.loading}</p>}>
        <NewsletterTokenAction action="unsubscribe" />
      </Suspense>
    </AccountShell>
  );
}
