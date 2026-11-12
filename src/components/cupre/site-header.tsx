"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import LanguageSwitcher from "@/components/cupre/language-switcher";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { IMAGES, MAIN_NAV } from "@/lib/cupre-content";
import { LOCALES, localePath, stripLocale } from "@/lib/i18n";

// Menüpont aktív-e az aktuális (nyelvi előtag nélküli) útvonalon: horgonyos pontok közül csak a „Főoldal” a főoldalon
function isActive(path: string, basePath: string): boolean {
  // Főoldali horgony: csak a „Főoldal” (#top) jelölhető aktívnak, és csak a főoldalon
  if (path.startsWith("/#")) {
    return path === "/#top" && basePath === "/";
  }
  return basePath === path || basePath.startsWith(`${path}/`);
}

// Ragadós fejléc: logó, desktop menü, nyelvválasztó, ikon gombok (keresés, fiók, kosár) és a mobil hamburger menü
export default function SiteHeader() {
  const { cartQty, openCart, showToast } = useShop();
  const { lang, dict } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const basePath = stripLocale(usePathname());

  return (
    <header className="header" id="top">
      <div className="nav wrap">
        <Link aria-label={dict.nav.homeAria} className="brand" href={localePath(lang, "/#top")}>
          <Image alt="" src={IMAGES.logo} width={160} height={150} unoptimized preload />
          <span className="wordmark">CUPRÉ</span>
          <span className="brand-sub">
            {dict.nav.brandSub[0]}
            <br />
            {dict.nav.brandSub[1]}
          </span>
        </Link>
        <nav aria-label={dict.nav.mainMenu} className="desktop-nav">
          {MAIN_NAV.map((item) => (
            <Link
              key={item.path}
              href={localePath(lang, item.path)}
              className={isActive(item.path, basePath) ? "active" : undefined}
            >
              {dict.nav[item.labelKey]}
            </Link>
          ))}
        </nav>
        <div className="nav-actions">
          <LanguageSwitcher />
          <button
            aria-label={dict.nav.search}
            className="icon-button search-button"
            onClick={() => showToast(dict.toasts.search)}
          >
            <svg viewBox="0 0 24 24">
              <circle cx="10.8" cy="10.8" r="7"></circle>
              <path d="m16 16 5 5"></path>
            </svg>
          </button>
          <Link aria-label={dict.nav.account} className="icon-button user-button" href={localePath(lang, "/fiok")}>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="7" r="4"></circle>
              <path d="M4 21c0-5 3-8 8-8s8 3 8 8"></path>
            </svg>
          </Link>
          <button aria-label={dict.nav.openCart} className="icon-button cart-button" id="cartOpen" onClick={openCart}>
            <svg viewBox="0 0 24 24">
              <path d="M2 3h3l2.5 12h12L22 7H6"></path>
              <circle cx="10" cy="20" r="1"></circle>
              <circle cx="19" cy="20" r="1"></circle>
            </svg>
            <span id="cartCount">{cartQty}</span>
          </button>
          <button
            aria-expanded={menuOpen}
            aria-label={dict.nav.openMenu}
            className="icon-button hamburger"
            id="menuToggle"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <svg viewBox="0 0 24 24">
              <path d="M3 6h18M3 12h18M3 18h18"></path>
            </svg>
          </button>
        </div>
      </div>
      <nav aria-label={dict.nav.mobileMenu} className={menuOpen ? "mobile-nav open" : "mobile-nav"} id="mobileNav">
        {MAIN_NAV.map((item) => (
          <Link key={item.path} href={localePath(lang, item.path)} onClick={() => setMenuOpen(false)}>
            {dict.nav[item.labelKey]}
          </Link>
        ))}
        <div className="mobile-lang" aria-label={dict.language.label} role="group">
          {LOCALES.map((code) => (
            <Link
              key={code}
              href={localePath(code, basePath)}
              hrefLang={code}
              lang={code}
              aria-current={code === lang ? "true" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              {code.toUpperCase()}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
