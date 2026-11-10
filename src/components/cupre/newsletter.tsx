import Image from "next/image";
import Link from "next/link";
import { IMAGES } from "@/lib/cupre-content";
import { localePath, type Dictionary, type Locale } from "@/lib/i18n";

// Hírlevél sáv a főoldalon; a gomb a feliratkozó oldalra visz (a sáv megjelenése változatlan)
export default function Newsletter({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <section className="newsletter">
      <div className="wrap newsletter-inner">
        <Image alt="" src={IMAGES.logo} width={160} height={141} quality={90} />
        <div>
          <h2>{dict.newsletterBand.title}</h2>
          <p>{dict.newsletterBand.text}</p>
        </div>
        <Link className="btn btn-outline-dark" href={localePath(lang, "/hirlevel")}>
          {dict.newsletterBand.button}
        </Link>
      </div>
    </section>
  );
}
