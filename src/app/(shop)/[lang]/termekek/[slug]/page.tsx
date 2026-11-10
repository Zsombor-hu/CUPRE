import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductDetail from "@/components/cupre/product-detail";
import { getProductBySlug, getProductSlugs } from "@/services/product-service";
import { LOCALES, hasLocale, localePath } from "@/lib/i18n";

// A build után felvett (még nem előgenerált) slugoknál az oldal blokkolva renderelhet; ismeretlen slugra úgyis 404 jön
export const instant = false;

// Build idején minden nyelv × products.json-beli termék oldala előre elkészül
export function generateStaticParams() {
  return getProductSlugs().map((slug) => ({ slug }));
}

// Oldalcím, leírás és nyelvi változatok a termék adataiból
export async function generateMetadata({ params }: PageProps<"/[lang]/termekek/[slug]">): Promise<Metadata> {
  const { lang, slug } = await params;
  const product = hasLocale(lang) ? getProductBySlug(slug, lang) : undefined;
  // Ismeretlen nyelvnél vagy terméknél az alapértelmezett cím marad
  if (!product) {
    return {};
  }
  return {
    title: `${product.name} | CUPRÉ`,
    description: product.description,
    alternates: {
      languages: Object.fromEntries(LOCALES.map((code) => [code, localePath(code, `/termekek/${slug}`)])),
    },
  };
}

// Termékoldal: ismeretlen nyelv vagy slug esetén 404
export default async function ProductPage({ params }: PageProps<"/[lang]/termekek/[slug]">) {
  const { lang, slug } = await params;
  const product = hasLocale(lang) ? getProductBySlug(slug, lang) : undefined;
  // Nem létező termékre a 404 oldal jelenik meg
  if (!product) {
    notFound();
  }
  return (
    <main>
      <ProductDetail product={product} />
    </main>
  );
}
