import { notFound } from "next/navigation";
import { LegalLayout } from "@/components/cupre/legal-page";
import { legalMetadata } from "@/components/cupre/legal-route";
import { getDictionary } from "@/services/dictionary-service";
import { getCompanyInfo } from "@/services/company-service";
import { getImprintText } from "@/services/legal-service";
import { hasLocale } from "@/lib/i18n";
import type { CompanyDetails } from "@/types/company";

// Az impresszumban listázott cégadatok sorrendje
const COMPANY_FIELDS: (keyof CompanyDetails)[] = [
  "name",
  "seat",
  "postalAddress",
  "email",
  "phone",
  "registryNumber",
  "registryCourt",
  "taxNumber",
  "euVatNumber",
  "representative",
];

// Nyelvfüggő oldalcím és hreflang alternatívák
export async function generateMetadata({ params }: PageProps<"/[lang]/impresszum">) {
  const { lang } = await params;
  return hasLocale(lang) ? legalMetadata(lang, "impresszum", getImprintText(lang).title) : {};
}

// Impresszum (Ekertv.): a szolgáltató, a tárhelyszolgáltató, a békéltető testület és az adatvédelmi hatóság adatai
export default async function ImprintPage({ params }: PageProps<"/[lang]/impresszum">) {
  const { lang } = await params;
  // Nem támogatott nyelvre 404
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const text = getImprintText(lang);
  const info = getCompanyInfo();
  return (
    <LegalLayout dict={dict} lang={lang} current="impresszum" title={text.title} intro={text.intro}>
      <dl className="legal-facts">
        {COMPANY_FIELDS.map((field) => (
          <div key={field}>
            <dt>{dict.legal.fields[field]}</dt>
            <dd>{info.company[field]}</dd>
          </div>
        ))}
      </dl>
      <h2>{dict.legal.hosting}</h2>
      <p>
        {info.hosting.name} · {info.hosting.address} · {info.hosting.email}
      </p>
      <h2>{dict.legal.conciliation}</h2>
      <p>
        {info.conciliationBody.name} · {info.conciliationBody.address} · {info.conciliationBody.email} ·{" "}
        {info.conciliationBody.phone}
      </p>
      <h2>{dict.legal.authority}</h2>
      <p>
        {info.dataProtectionAuthority.name} · {info.dataProtectionAuthority.address} ·{" "}
        <a href={info.dataProtectionAuthority.website} rel="noopener noreferrer" target="_blank">
          {info.dataProtectionAuthority.website}
        </a>
      </p>
    </LegalLayout>
  );
}
