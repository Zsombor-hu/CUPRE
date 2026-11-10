"use client";

import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, localePath } from "@/lib/i18n";
import type { Product } from "@/types/product";

// Főoldali kiemelt termék blokk a products.json adataiból; a „Kosárba teszem” az első (alap) változatot teszi be
export default function ProductSection({ product }: { product: Product }) {
  const { addToCart } = useShop();
  const { lang, dict } = useI18n();
  const baseVariant = product.variants[0];

  return (
    <section className="product-section" id="termek">
      <div className="wrap product-grid">
        <div className="product-photo photo-frame">
          <Image
            alt={product.imageAlt}
            src={product.image}
            width={product.imageWidth}
            height={product.imageHeight}
            quality={90}
            sizes="(max-width: 850px) 100vw, 45vw"
          />
          <span className="photo-tag">{product.tag}</span>
        </div>
        <div className="product-details">
          <div className="eyebrow">{dict.product.featuredEyebrow}</div>
          <h2>
            <Link className="product-title-link" href={localePath(lang, `/termekek/${product.slug}`)}>
              {product.name}
            </Link>
          </h2>
          <h3>{product.subtitle}</h3>
          <p>{product.description}</p>
          <div className="product-points">
            {product.points.map((point) => (
              <div key={point.icon}>
                <span>{point.icon}</span>
                {point.label}
              </div>
            ))}
          </div>
          <div className="buy-row">
            <div>
              <strong>{formatPrice(baseVariant.priceHuf, lang)}</strong>
              <small>{baseVariant.priceNote}</small>
            </div>
            <button className="btn btn-copper" id="addCart" onClick={() => addToCart(baseVariant.sku)}>
              {dict.product.addToCart} <span>→</span>
            </button>
          </div>
          <p className="product-disclaimer">{product.disclaimer}</p>
        </div>
      </div>
    </section>
  );
}
