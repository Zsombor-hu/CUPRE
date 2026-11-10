"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/hooks/use-i18n";
import { LOCALES, localePath, stripLocale } from "@/lib/i18n";

// Nyelvválasztó a fejlécben: kompakt gomb az aktuális nyelvkóddal, lenyíló listával; ugyanarra az oldalra visz másik nyelven
export default function LanguageSwitcher() {
  const { lang, dict } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const basePath = stripLocale(pathname);

  // Nyitott listánál a kívülre kattintás és az Escape bezárja a listát
  useEffect(() => {
    // Zárt állapotban nincs mit figyelni
    if (!open) {
      return;
    }
    // Kattintás a választón kívül
    function onPointerDown(event: PointerEvent) {
      // A saját gombra/listára kattintást a gomb kezeli
      if (root.current && !root.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    // Escape billentyű
    function onKeyDown(event: KeyboardEvent) {
      // Csak az Escape zárja a listát
      if (event.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="lang-switch" ref={root}>
      <button
        type="button"
        className="lang-switch-button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={`${dict.language.label}: ${dict.language.names[lang]}`}
        onClick={() => setOpen((value) => !value)}
      >
        {lang.toUpperCase()}
        <svg viewBox="0 0 12 12" aria-hidden="true">
          <path d="m3 4.5 3 3 3-3"></path>
        </svg>
      </button>
      {open ? (
        <ul className="lang-switch-menu" aria-label={dict.language.label}>
          {LOCALES.map((code) => (
            <li key={code}>
              <Link
                href={localePath(code, basePath)}
                hrefLang={code}
                lang={code}
                aria-current={code === lang ? "true" : undefined}
                onClick={() => setOpen(false)}
              >
                <span>{code.toUpperCase()}</span>
                {dict.language.names[code]}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
