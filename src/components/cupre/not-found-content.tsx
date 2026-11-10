"use client";

import Link from "next/link";
import { useI18n } from "@/hooks/use-i18n";
import { localePath } from "@/lib/i18n";

// 404 tartalom a CUPRÉ stílusában, az aktuális nyelven (a not-found fájl nem kap params-t, ezért a nyelv a contextből jön)
export default function NotFoundContent() {
  const { lang, dict } = useI18n();
  return (
    <main>
      <section className="checkout-section">
        <div className="wrap">
          <div className="checkout-confirmation">
            <div className="eyebrow">{dict.notFound.eyebrow}</div>
            <h2>{dict.notFound.title}</h2>
            <p>{dict.notFound.text}</p>
            <Link className="btn btn-copper" href={localePath(lang, "/")}>
              {dict.notFound.back} <span>→</span>
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
