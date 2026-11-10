import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary, Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";

// Használati szekció: hálószobakép és a lepedő helyes elhelyezésének leírása
export default function Care({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <section className="care-section" id="hasznalat">
      <div className="wrap care-grid">
        <div className="care-image">
          <Image
            alt={dict.care.alt}
            src={IMAGES.care}
            width={1241}
            height={1268}
            quality={90}
            sizes="(max-width: 850px) 100vw, 50vw"
          />
        </div>
        <div className="care-copy">
          <div className="eyebrow">{dict.care.eyebrow}</div>
          <h2>
            {dict.care.title[0]}
            <br />
            {dict.care.title[1]}
          </h2>
          {dict.care.paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          <a className="text-link" href={localePath(lang, "/#gyik")}>
            {dict.care.link} <span>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
