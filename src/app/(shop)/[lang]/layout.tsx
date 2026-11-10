import type { Metadata, Viewport } from "next";
import { notFound } from "next/navigation";
import I18nProvider from "@/components/cupre/i18n-provider";
import ShopProvider from "@/components/cupre/shop-provider";
import SiteHeader from "@/components/cupre/site-header";
import SiteFooter from "@/components/cupre/site-footer";
import CartDrawer from "@/components/cupre/cart-drawer";
import Toast from "@/components/cupre/toast";
import { getCachedCatalogVariants } from "@/services/cached-data";
import { getDictionary } from "@/services/dictionary-service";
import { LOCALES, hasLocale, localePath } from "@/lib/i18n";
import "../cupre.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#09251e",
};

// Mindhárom nyelv előre elkészül build közben
export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

// Nyelvfüggő alap metaadatok és a nyelvi változatok (hreflang) jelzése a keresőknek
export async function generateMetadata({ params }: LayoutProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  // Ismeretlen nyelvre nincs metaadat, a layout 404-et ad
  if (!hasLocale(lang)) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: dict.meta.title,
    description: dict.meta.description,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((code) => [code, localePath(code, "/")])),
    },
  };
}

// A CUPRÉ webshop nyelvenkénti root layoutja: nincs benne Tailwind/HeroUI, csak a cupre.css.
// A fejléc, lábléc, kosár és toast itt van, így a kosár oldalváltáskor is megmarad;
// a szótár és a nyelvre feloldott termékkatalógus innen jut el a kliens komponensekhez
export default async function ShopLayout({ children, params }: LayoutProps<"/[lang]">) {
  const { lang } = await params;
  // Nem támogatott nyelvi előtag esetén 404
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const catalog = await getCachedCatalogVariants(lang);
  return (
    <html lang={lang}>
      <body>
        <I18nProvider lang={lang} dict={dict}>
          <ShopProvider catalog={catalog}>
            <SiteHeader />
            {children}
            <SiteFooter dict={dict} lang={lang} />
            <CartDrawer />
            <Toast />
          </ShopProvider>
        </I18nProvider>
      </body>
    </html>
  );
}
