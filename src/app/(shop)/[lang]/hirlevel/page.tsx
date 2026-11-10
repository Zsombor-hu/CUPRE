import AccountShell from "@/components/cupre/account-shell";
import { NewsletterSubscribeForm } from "@/components/cupre/newsletter-forms";
import { privatePageMetadata, resolvePageLang } from "@/components/cupre/page-meta";

// Nyelvfüggő oldalcím
export async function generateMetadata({ params }: PageProps<"/[lang]/hirlevel">) {
  return privatePageMetadata(params, (dict) => dict.meta.newsletterTitle);
}

// Hírlevél-feliratkozás vásárlás és regisztráció nélkül
export default async function NewsletterPage({ params }: PageProps<"/[lang]/hirlevel">) {
  const { dict } = await resolvePageLang(params);
  return (
    <AccountShell eyebrow={dict.newsletter.eyebrow} title={dict.newsletter.title} intro={dict.newsletter.intro}>
      <NewsletterSubscribeForm />
    </AccountShell>
  );
}
