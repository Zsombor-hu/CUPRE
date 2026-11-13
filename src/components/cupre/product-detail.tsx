"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, localePath } from "@/lib/i18n";
import type { Product } from "@/types/product";

// Termékoldal: kép, leírás és változatválasztó (méret + osztály egy listában); az ár és a cikkszám a kiválasztott változatot követi.
// A „vissza a terméklistához” link csak akkor jelenik meg, ha a katalógus több terméket tartalmaz
export default function ProductDetail({ product, showBack }: { product: Product; showBack: boolean }) {
  const { addToCart } = useShop();
  const { lang, dict } = useI18n();
  // Alapból az első rendelhető (nem elfogyott) változat van kiválasztva
  const [selectedSku, setSelectedSku] = useState((product.variants.find((variant) => !variant.soldOut) ?? product.variants[0]).sku);
  const selected = product.variants.find((variant) => variant.sku === selectedSku) ?? product.variants[0];
  // Másodosztályú változat esetén kis betűs tájékoztatás a lehetséges optikai eltérésekről
  const hasSecondGrade = product.variants.some((variant) => variant.grade === "second");

  return (
    <section className="product-section product-page">
      {showBack ? (
        <div className="wrap">
          <Link className="product-back" href={localePath(lang, "/termekek")}>
            {dict.product.back}
          </Link>
        </div>
      ) : null}
      <div className="wrap product-grid">
        <div className="product-photo photo-frame">
          <Image
            alt={product.imageAlt}
            src={product.image}
            width={product.imageWidth}
            height={product.imageHeight}
            quality={90}
            sizes="(max-width: 850px) 100vw, 55vw"
            preload
          />
          <span className="photo-tag">{product.tag}</span>
        </div>
        <div className="product-details">
          <div className="eyebrow">{dict.product.collectionEyebrow}</div>
          <h1>{product.name}</h1>
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
          <div className="buy-row">
            <div>
              <strong>{formatPrice(selected.priceHuf, lang)}</strong>
              <small>
                {selected.priceNote} · {dict.product.sku}: {selected.sku}
              </small>
            </div>
            {/* Elfogyott változat nem tehető kosárba */}
            {selected.soldOut ? (
              <button className="btn btn-copper" disabled aria-disabled="true">
                {dict.product.soldOut}
              </button>
            ) : (
              <button className="btn btn-copper" onClick={() => addToCart(selected.sku)}>
                {dict.product.addToCart} <span>→</span>
              </button>
            )}
          </div>
          <p className="product-disclaimer">
            {dict.productInfo.grossNote} {product.disclaimer}
          </p>
          {hasSecondGrade ? <p className="product-disclaimer product-grade-note">{dict.product.secondGradeNote}</p> : null}
        </div>
      </div>
      <div className="wrap">
        <section className="product-info" aria-labelledby="productInfoTitle">
          <h2 id="productInfoTitle">{dict.productInfo.title}</h2>
          <dl>
            <div>
              <dt>{dict.productInfo.composition}</dt>
              <dd>{product.productInfo.composition}</dd>
            </div>
            <div>
              <dt>{dict.productInfo.care}</dt>
              <dd>{product.productInfo.care}</dd>
            </div>
            <div>
              <dt>{dict.productInfo.manufacturer}</dt>
              <dd>
                {product.productInfo.manufacturer.name} · {product.productInfo.manufacturer.address}
              </dd>
            </div>
            {product.productInfo.euResponsible ? (
              <div>
                <dt>{dict.productInfo.euResponsible}</dt>
                <dd>
                  {product.productInfo.euResponsible.name} · {product.productInfo.euResponsible.address}
                </dd>
              </div>
            ) : null}
            <div>
              <dt>{dict.productInfo.productId}</dt>
              <dd>
                {product.productInfo.productId} · {dict.product.sku}: {selected.sku}
              </dd>
            </div>
            <div>
              <dt>{dict.productInfo.safety}</dt>
              <dd>{product.productInfo.safety}</dd>
            </div>
          </dl>
        </section>
      </div>
    </section>
  );
}
