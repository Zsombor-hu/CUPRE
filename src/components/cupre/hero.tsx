import type { Dictionary } from "@/lib/i18n";

// Hero szekció: bal oldalon sötétzöld szöveges rész, jobb oldalon a hálószobakép lágy átmenettel (a kép a CSS-ből jön)
export default function Hero({ dict }: { dict: Dictionary }) {
  return (
    <section aria-labelledby="heroTitle" className="hero">
      <div className="hero-photo"></div>
      <div className="hero-shade"></div>
      <div className="hero-inner wrap">
        <div className="hero-content">
          <div className="eyebrow light">{dict.hero.eyebrow}</div>
          <h1 id="heroTitle">
            {dict.hero.title}
            <br />
            <em>{dict.hero.titleAccent}</em>
          </h1>
          <p>{dict.hero.text}</p>
          <a className="btn btn-copper" href="#termek">
            {dict.hero.cta} <span>→</span>
          </a>
        </div>
      </div>
    </section>
  );
}
