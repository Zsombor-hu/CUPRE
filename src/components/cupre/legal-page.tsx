import Link from "next/link";
import { localePath, type Dictionary, type Locale } from "@/lib/i18n";
import type { LegalDocument, LegalPageKey } from "@/types/legal";

// A jogi aloldalak sorrendje az oldalsó navigációban és a láblécben
export const LEGAL_PAGES: LegalPageKey[] = ["aszf", "adatvedelem", "elallas", "impresszum"];

// Jogi oldal kerete: cím, vázlat-figyelmeztetés, oldalsó navigáció a többi jogi oldalra és a tartalom
export function LegalLayout({
  dict,
  lang,
  current,
  title,
  intro,
  children,
}: {
  dict: Dictionary;
  lang: Locale;
  current: LegalPageKey;
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <main>
      <section className="legal-section">
        <div className="wrap legal-layout">
          <nav className="legal-nav" aria-label={dict.legal.footerTitle}>
            {LEGAL_PAGES.map((key) => (
              <Link
                key={key}
                href={localePath(lang, `/${key}`)}
                aria-current={key === current ? "page" : undefined}
              >
                {dict.legal.nav[key]}
              </Link>
            ))}
          </nav>
          <article className="legal-article">
            <h1>{title}</h1>
            <p className="legal-draft">{dict.legal.draftNotice}</p>
            <p className="legal-intro">{intro}</p>
            {children}
          </article>
        </div>
      </section>
    </main>
  );
}

// Szöveges jogi dokumentum (ÁSZF, adatkezelés, elállás) fejezetekkel és opcionális nyilatkozatmintával
export default function LegalPage({
  dict,
  lang,
  current,
  doc,
}: {
  dict: Dictionary;
  lang: Locale;
  current: LegalPageKey;
  doc: LegalDocument;
}) {
  return (
    <LegalLayout dict={dict} lang={lang} current={current} title={doc.title} intro={doc.intro}>
      {doc.sections.map((section) => (
        <section key={section.heading}>
          <h2>{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
      ))}
      {doc.form ? (
        <section className="legal-form">
          <h2>{doc.form.title}</h2>
          <p className="legal-form-note">{doc.form.note}</p>
          {doc.form.lines.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </section>
      ) : null}
    </LegalLayout>
  );
}
