"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, localePath } from "@/lib/i18n";
import type { Product, ProductGrade } from "@/types/product";

// Az osztályválasztó gombjainak sorrendje
const GRADES: ProductGrade[] = ["first", "second"];

// Termékoldal: kép, leírás, méret- és osztályválasztó; az ár és a cikkszám a kiválasztott változatot követi
export default function ProductDetail({ product }: { product: Product }) {
  const { addToCart } = useShop();
  const { lang, dict } = useI18n();
  const sizes = [...new Set(product.variants.map((variant) => variant.size))];
  const [size, setSize] = useState(product.variants[0].size);
  const [grade, setGrade] = useState<ProductGrade>(product.variants[0].grade);

  const gradesForSize = product.variants.filter((variant) => variant.size === size).map((variant) => variant.grade);
  const selected =
    product.variants.find((variant) => variant.size === size && variant.grade === grade) ??
    product.variants.find((variant) => variant.size === size) ??
    product.variants[0];

  // Méretváltáskor, ha az adott méretben nincs meg a választott osztály, az első elérhetőre váltunk
  function selectSize(nextSize: string) {
    setSize(nextSize);
    const available = product.variants.filter((variant) => variant.size === nextSize).map((variant) => variant.grade);
    // A korábbi osztály megtartása, ha ebben a méretben is létezik
    if (!available.includes(grade)) {
      setGrade(available[0]);
    }
  }

  return (
    <section className="product-section product-page">
      <div className="wrap">
        <Link className="product-back" href={localePath(lang, "/termekek")}>
          {dict.product.back}
        </Link>
      </div>
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
            <div className="variant-group" role="group" aria-label={dict.product.size}>
              <span className="variant-label">{dict.product.size}</span>
              <div className="variant-options">
                {sizes.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="variant-option"
                    aria-pressed={option === size}
                    onClick={() => selectSize(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="variant-group" role="group" aria-label={dict.product.grade}>
              <span className="variant-label">{dict.product.grade}</span>
              <div className="variant-options">
                {GRADES.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className="variant-option"
                    aria-pressed={option === selected.grade}
                    disabled={!gradesForSize.includes(option)}
                    onClick={() => setGrade(option)}
                  >
                    {dict.product.grades[option]}
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
            <button className="btn btn-copper" onClick={() => addToCart(selected.sku)}>
              {dict.product.addToCart} <span>→</span>
            </button>
          </div>
          <p className="product-disclaimer">
            {dict.productInfo.grossNote} {product.disclaimer}
          </p>
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
