import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getCachedProducts } from "@/services/cached-data";
import { getDictionary } from "@/services/dictionary-service";
import { formatPrice, hasLocale, interpolate, localePath, LOCALES } from "@/lib/i18n";

// Nyelvfüggő oldalcím és leírás
export async function generateMetadata({ params }: PageProps<"/[lang]/termekek">): Promise<Metadata> {
  const { lang } = await params;
  // Ismeretlen nyelvnél a layout 404-et ad
  if (!hasLocale(lang)) {
    return {};
  }
  const dict = getDictionary(lang);
  return {
    title: dict.meta.productsTitle,
    description: dict.meta.productsDescription,
    alternates: { languages: Object.fromEntries(LOCALES.map((code) => [code, localePath(code, "/termekek")])) },
  };
}

// Terméklista: a környezet products.json fájljának összes terméke, a legkedvezőbb árral és az elérhető osztályokkal
export default async function ProductsPage({ params }: PageProps<"/[lang]/termekek">) {
  const { lang } = await params;
  // Nem támogatott nyelvre 404
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const products = await getCachedProducts(lang);
  return (
    <main>
      <section className="copper-story products-section">
        <div className="wrap story-heading">
          <span className="line"></span>
          <div>
            <div className="eyebrow">{dict.products.eyebrow}</div>
            <h1>{dict.products.title}</h1>
            <p>{dict.products.text}</p>
          </div>
          <span className="line"></span>
        </div>
        <div className="wrap story-cards products-grid">
          {products.map((product) => {
            const minPrice = Math.min(...product.variants.map((variant) => variant.priceHuf));
            const grades = [...new Set(product.variants.map((variant) => dict.product.grades[variant.grade]))].join(", ");
            const sizes = [...new Set(product.variants.map((variant) => variant.size))].join(", ");
            return (
              <Link
                className="story-card product-card"
                href={localePath(lang, `/termekek/${product.slug}`)}
                key={product.slug}
              >
                <Image
                  alt={product.imageAlt}
                  src={product.image}
                  width={product.imageWidth}
                  height={product.imageHeight}
                  quality={90}
                  sizes="(max-width: 520px) 100vw, (max-width: 850px) 50vw, 33vw"
                />
                <h3>{product.name}</h3>
                <p>
                  {product.subtitle} · {sizes} · {grades}
                </p>
                <p className="product-card-price">
                  {interpolate(dict.products.fromPrice, { price: formatPrice(minPrice, lang) })} <span>→</span>
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}
