"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, localePath } from "@/lib/i18n";
import type { Product } from "@/types/product";

// Főoldali kiemelt termék blokk a products.json adataiból; a változatok itt is választhatók, a „Kosárba teszem” a kiválasztottat teszi be
export default function ProductSection({ product }: { product: Product }) {
  const { addToCart } = useShop();
  const { lang, dict } = useI18n();
  // Alapból az első rendelhető (nem elfogyott) változat van kiválasztva
  const [selectedSku, setSelectedSku] = useState((product.variants.find((variant) => !variant.soldOut) ?? product.variants[0]).sku);
  const selected = product.variants.find((variant) => variant.sku === selectedSku) ?? product.variants[0];
  // Másodosztályú változat esetén kis betűs tájékoztatás az optikai eltérésekről
  const hasSecondGrade = product.variants.some((variant) => variant.grade === "second");

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
          {product.variants.length > 1 ? (
            <div className="variant-picker">
              <div className="variant-group" role="group" aria-label={dict.product.variant}>
                <span className="variant-label">{dict.product.variant}</span>
                <div className="variant-options">
                  {product.variants.map((variant) => (
                    <button
                      key={variant.sku}
                      type="button"
                      className="variant-option"
                      aria-pressed={variant.sku === selected.sku}
                      onClick={() => setSelectedSku(variant.sku)}
                    >
                      {variant.size}, {dict.product.grades[variant.grade]} · {variant.soldOut ? dict.product.soldOut : formatPrice(variant.priceHuf, lang)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          <div className="buy-row">
            <div>
              <strong>{formatPrice(selected.priceHuf, lang)}</strong>
              <small>{selected.priceNote}</small>
            </div>
            {/* Elfogyott változat nem tehető kosárba */}
            {selected.soldOut ? (
              <button className="btn btn-copper" id="addCart" disabled aria-disabled="true">
                {dict.product.soldOut}
              </button>
            ) : (
              <button className="btn btn-copper" id="addCart" onClick={() => addToCart(selected.sku)}>
                {dict.product.addToCart} <span>→</span>
              </button>
            )}
          </div>
          <p className="product-disclaimer">{product.disclaimer}</p>
          {hasSecondGrade ? <p className="product-disclaimer product-grade-note">{dict.product.secondGradeNote}</p> : null}
        </div>
      </div>
    </section>
  );
}
