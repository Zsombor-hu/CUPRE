"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useShop } from "@/hooks/use-shop";
import { useI18n } from "@/hooks/use-i18n";
import { formatPrice, interpolate, localePath } from "@/lib/i18n";

// Jobbról beúszó kosár drawer háttérrel: tételenként méret, osztály, ár és mennyiség; a pénztár a /penztar oldalra visz
export default function CartDrawer() {
  const { lines, cartTotalHuf, cartOpen, closeCart, changeLineQty, showToast } = useShop();
  const { lang, dict } = useI18n();
  const closeButton = useRef<HTMLButtonElement>(null);
  const router = useRouter();

  // Megnyitáskor a fókusz a bezáró gombra kerül (akadálymentesség, a prototípussal egyezően)
  useEffect(() => {
    // Csak nyitáskor fókuszálunk, záráskor nem
    if (cartOpen) {
      closeButton.current?.focus();
    }
  }, [cartOpen]);

  // Pénztárba lépés: üres kosárnál csak tájékoztatunk, egyébként bezárjuk a drawert és átnavigálunk
  function goToCheckout() {
    // Üres kosárral nincs mit rendelni
    if (lines.length === 0) {
      showToast(dict.toasts.emptyCart);
      return;
    }
    closeCart();
    router.push(localePath(lang, "/penztar"));
  }

  return (
    <>
      <div className={cartOpen ? "drawer-backdrop show" : "drawer-backdrop"} id="drawerBackdrop" onClick={closeCart}></div>
      <aside
        aria-label={dict.cart.aria}
        aria-modal="true"
        className={cartOpen ? "cart-drawer open" : "cart-drawer"}
        id="cartDrawer"
        role="dialog"
      >
        <div className="drawer-head">
          <h2>{dict.cart.title}</h2>
          <button aria-label={dict.cart.close} className="close-drawer" id="cartClose" ref={closeButton} onClick={closeCart}>
            ×
          </button>
        </div>
        <div className="drawer-content" id="cartContent">
          {lines.length === 0 ? (
            <p>{dict.cart.empty}</p>
          ) : (
            <>
              {lines.map((line) => (
                <div className="cart-item" key={line.sku}>
                  {/* A CSS csak szélességet ad, ezért height:auto kell a torzítás elkerüléséhez */}
                  <Image
                    alt={interpolate(dict.cart.imageAlt, { name: line.variant.productName })}
                    src={line.variant.image}
                    width={190}
                    height={105}
                    quality={90}
                    style={{ height: "auto" }}
                  />
                  <div>
                    <h3>{line.variant.productName}</h3>
                    <p>
                      {line.variant.size} · {dict.product.grades[line.variant.grade]}
                    </p>
                    <p>
                      <strong>{formatPrice(line.lineTotalHuf, lang)}</strong> · {line.variant.priceNote}
                    </p>
                    <div className="qty">
                      <button aria-label={dict.cart.decrease} onClick={() => changeLineQty(line.sku, -1)}>
                        −
                      </button>
                      <span>{interpolate(dict.cart.pieces, { qty: line.qty })}</span>
                      <button aria-label={dict.cart.increase} onClick={() => changeLineQty(line.sku, 1)}>
                        +
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {lines.length > 1 ? (
                <p className="cart-total">
                  {dict.cart.total} <strong>{formatPrice(cartTotalHuf, lang)}</strong>
                </p>
              ) : null}
            </>
          )}
        </div>
        <div className="drawer-bottom">
          <p>{dict.cart.inactive}</p>
          <button className="btn btn-copper" onClick={goToCheckout}>
            {dict.cart.checkout}
          </button>
        </div>
      </aside>
    </>
  );
}
