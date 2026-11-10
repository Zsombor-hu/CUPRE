import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDictionary } from "@/services/dictionary-service";
import { hasLocale, type Dictionary, type Locale } from "@/lib/i18n";

// Fiók- és hírlevél-oldalak metaadata: nyelvfüggő cím; ezek az oldalak nem kerülnek a keresőkbe
export async function privatePageMetadata(
  params: Promise<{ lang: string }>,
  pickTitle: (dict: Dictionary) => string,
): Promise<Metadata> {
  const { lang } = await params;
  // Ismeretlen nyelvnél a layout 404-et ad
  if (!hasLocale(lang)) {
    return {};
  }
  return { title: pickTitle(getDictionary(lang)), robots: { index: false } };
}

// Az URL nyelve és szótára; nem támogatott nyelvre 404
export async function resolvePageLang(params: Promise<{ lang: string }>): Promise<{ lang: Locale; dict: Dictionary }> {
  const { lang } = await params;
  // Nem támogatott nyelvi előtag
  if (!hasLocale(lang)) {
    notFound();
  }
  return { lang, dict: getDictionary(lang) };
}
