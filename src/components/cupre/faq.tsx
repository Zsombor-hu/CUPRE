import type { FaqItem } from "@/types/faq";
import type { Dictionary } from "@/lib/i18n";

// Gyakori kérdések natív <details> elemekkel, a környezet faq.json fájljából, az aktuális nyelven
export default function Faq({ dict, items }: { dict: Dictionary; items: FaqItem[] }) {
  return (
    <section className="faq-section" id="gyik">
      <div className="wrap">
        <div className="section-title">
          <div className="eyebrow">{dict.faq.eyebrow}</div>
          <h2>{dict.faq.title}</h2>
        </div>
        <div className="faq-list">
          {items.map((item) => (
            <details key={item.id}>
              <summary>{item.question}</summary>
              <p>
                {item.answer}
                {item.link ? (
                  <>
                    {" "}
                    <a href={item.link.href}>{item.link.label}</a>
                  </>
                ) : null}
              </p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
