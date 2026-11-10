import Link from "next/link";
import { LEGAL_PAGES } from "@/components/cupre/legal-page";
import { localePath, type Dictionary, type Locale } from "@/lib/i18n";

// Lábléc: márka, felfedezés és információ linkek, kapcsolat helye és jogi sor (az aktuális nyelven)
export default function SiteFooter({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  const href = (path: string) => localePath(lang, path);
  return (
    <footer>
      <div className="wrap footer-grid">
        <div>
          <Link className="footer-brand" href={href("/#top")}>
            CUPRÉ
          </Link>
          <p>
            {dict.footer.tagline[0]}
            <br />
            {dict.footer.tagline[1]}
          </p>
        </div>
        <div>
          <h4>{dict.footer.explore}</h4>
          <Link href={href("/#termek")}>{dict.footer.featuredProduct}</Link>
          <Link href={href("/#rez")}>{dict.footer.copper}</Link>
          <Link href={href("/#technologia")}>{dict.footer.technology}</Link>
          <Link href={href("/#marka")}>{dict.footer.about}</Link>
        </div>
        <div>
          <h4>{dict.footer.info}</h4>
          <Link href={href("/#hasznalat")}>{dict.footer.usage}</Link>
          <Link href={href("/#gyik")}>{dict.footer.faq}</Link>
          <Link href={href("/#csomagolas")}>{dict.footer.packaging}</Link>
        </div>
        <div>
          <h4>{dict.footer.contact}</h4>
          <p>{dict.footer.contactText}</p>
        </div>
      </div>
      <div className="wrap legal">
        <nav className="legal-links" aria-label={dict.legal.footerTitle}>
          {LEGAL_PAGES.map((key) => (
            <Link key={key} href={href(`/${key}`)}>
              {dict.legal.nav[key]}
            </Link>
          ))}
        </nav>
        {dict.footer.legal}
      </div>
    </footer>
  );
}
