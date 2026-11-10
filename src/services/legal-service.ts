import "server-only";
import hu from "@/data/legal/hu.json";
import en from "@/data/legal/en.json";
import de from "@/data/legal/de.json";
import { interpolate, type Locale } from "@/lib/i18n";
import { getLegalTokens } from "@/services/company-service";
import type { LegalDocument, LegalDocumentKey } from "@/types/legal";

// A jogi szövegek nyelvenként (src/data/legal); a cégadatok {helyettesítőként} kerülnek beléjük a company.json-ból
type LegalTexts = typeof hu;
const TEXTS: Record<Locale, LegalTexts> = {
  hu,
  en: en satisfies LegalTexts,
  de: de satisfies LegalTexts,
};

// Az impresszum bevezető szövege és címe (az adatokat az oldal a company.json-ból listázza)
export function getImprintText(lang: Locale): { title: string; intro: string } {
  return TEXTS[lang].impresszum;
}

// Jogi dokumentum az adott nyelven, a cégadatokkal kitöltve
export function getLegalDocument(lang: Locale, key: LegalDocumentKey): LegalDocument {
  const tokens = getLegalTokens();
  const doc: LegalDocument = TEXTS[lang][key];
  const fill = (text: string) => interpolate(text, tokens);
  return {
    title: doc.title,
    intro: fill(doc.intro),
    sections: doc.sections.map((section) => ({
      heading: section.heading,
      paragraphs: section.paragraphs.map(fill),
    })),
    form: doc.form ? { ...doc.form, lines: doc.form.lines.map(fill) } : undefined,
  };
}
