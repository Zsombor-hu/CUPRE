import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary, Locale } from "@/lib/i18n";
import { localePath } from "@/lib/i18n";

// Technológiai magyarázat: ragadós kép bal oldalon, négy számozott tény és megfelelőségi megjegyzés jobb oldalon
export default function Technology({ dict, lang }: { dict: Dictionary; lang: Locale }) {
  return (
    <section aria-labelledby="technologyTitle" className="technology-section" id="technologia">
      <div className="wrap technology-layout">
        <div className="technology-visual">
          <Image
            alt={dict.technology.alt}
            src={IMAGES.technology}
            width={1536}
            height={1024}
            quality={90}
            sizes="(max-width: 850px) 100vw, 45vw"
          />
          <div className="tech-visual-caption">{dict.technology.caption}</div>
        </div>
        <div className="technology-copy">
          <div className="eyebrow">{dict.technology.eyebrow}</div>
          <h2 id="technologyTitle">{dict.technology.title}</h2>
          <p>{dict.technology.intro}</p>
          <div className="technology-facts">
            {dict.technology.facts.map((fact, index) => (
              <article key={fact.title}>
                <span className="fact-no">{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <h3>{fact.title}</h3>
                  <p>{fact.text}</p>
                </div>
              </article>
            ))}
          </div>
          <p className="tech-note">{dict.technology.note}</p>
          <a className="text-link" href={localePath(lang, "/#gyik")}>
            {dict.technology.link} <span>↗</span>
          </a>
        </div>
      </div>
    </section>
  );
}
