import { notFound } from "next/navigation";
import Hero from "@/components/cupre/hero";
import Benefits from "@/components/cupre/benefits";
import ProductSection from "@/components/cupre/product-section";
import GiftBanner from "@/components/cupre/gift-banner";
import CopperStory from "@/components/cupre/copper-story";
import Technology from "@/components/cupre/technology";
import Care from "@/components/cupre/care";
import BrandStory from "@/components/cupre/brand-story";
import Packaging from "@/components/cupre/packaging";
import Faq from "@/components/cupre/faq";
import Newsletter from "@/components/cupre/newsletter";
import { getFeaturedProduct } from "@/services/product-service";
import { getFaqItems } from "@/services/faq-service";
import { getDictionary } from "@/services/dictionary-service";
import { hasLocale } from "@/lib/i18n";

// CUPRÉ főoldal: a szekciók sorrendje egyezik az eredeti prototípussal; a szövegek a nyelv szótárából,
// a kiemelt termék és a GYIK a környezet JSON adataiból jön
export default async function HomePage({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  // Nem támogatott nyelvre 404
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  return (
    <main>
      <Hero dict={dict} />
      <Benefits dict={dict} />
      <ProductSection product={getFeaturedProduct(lang)} />
      <GiftBanner dict={dict} />
      <CopperStory dict={dict} />
      <Technology dict={dict} lang={lang} />
      <Care dict={dict} lang={lang} />
      <BrandStory dict={dict} />
      <Packaging dict={dict} />
      <Faq dict={dict} items={getFaqItems(lang)} />
      <Newsletter dict={dict} lang={lang} />
    </main>
  );
}
