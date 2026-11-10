import type { Metadata } from "next";
import { notFound } from "next/navigation";
import LegalPage from "@/components/cupre/legal-page";
import { getDictionary } from "@/services/dictionary-service";
import { getLegalDocument } from "@/services/legal-service";
import { LOCALES, hasLocale, localePath } from "@/lib/i18n";
import type { LegalDocumentKey, LegalPageKey } from "@/types/legal";

// Közös metaadat a jogi oldalakhoz: nyelvfüggő cím és hreflang alternatívák
export function legalMetadata(lang: string, key: LegalPageKey, title: string): Metadata {
  // Ismeretlen nyelvnél a layout 404-et ad
  if (!hasLocale(lang)) {
    return {};
  }
  return {
    title: `${title} | CUPRÉ`,
    alternates: { languages: Object.fromEntries(LOCALES.map((code) => [code, localePath(code, `/${key}`)])) },
  };
}

// Szöveges jogi dokumentum oldalának metaadata
export async function legalDocumentMetadata(
  params: Promise<{ lang: string }>,
  key: LegalDocumentKey,
): Promise<Metadata> {
  const { lang } = await params;
  // A dokumentum címe csak támogatott nyelven olvasható ki
  if (!hasLocale(lang)) {
    return {};
  }
  return legalMetadata(lang, key, getLegalDocument(lang, key).title);
}

// Szöveges jogi dokumentum oldala (ÁSZF, adatkezelés, elállás) az URL nyelvén
export async function LegalDocumentRoute({
  params,
  documentKey,
}: {
  params: Promise<{ lang: string }>;
  documentKey: LegalDocumentKey;
}) {
  const { lang } = await params;
  // Nem támogatott nyelvre 404
  if (!hasLocale(lang)) {
    notFound();
  }
  return (
    <LegalPage
      dict={getDictionary(lang)}
      lang={lang}
      current={documentKey}
      doc={getLegalDocument(lang, documentKey)}
    />
  );
}
