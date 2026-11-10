"use client";

import { createContext, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CartLine, CartLineView, ShopContextValue } from "@/types/cupre";
import type { CatalogVariant } from "@/types/product";
import { CART_STORAGE_KEY, TOAST_DURATION_MS } from "@/lib/cupre-content";

export const ShopContext = createContext<ShopContextValue | null>(null);

// Egy tételből kosárba tehető legnagyobb mennyiség (a szerver is ezt ellenőrzi)
const MAX_QTY = 99;

// localStorage-ból visszaolvasott kosár ellenőrzése; hibás vagy hiányzó adatnál üres kosár
function readStoredCart(): CartLine[] {
  // Privát mód vagy tiltott tárhely esetén a getItem/JSON.parse kivételt dobhat
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    // Csak érvényes { sku, qty } elemeket fogadunk el
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.filter(
      (line): line is CartLine =>
        typeof line?.sku === "string" && Number.isInteger(line?.qty) && line.qty > 0 && line.qty <= MAX_QTY,
    );
  } catch {
    return [];
  }
}

// Kliensoldali állapot a webshophoz: kosártételek (localStorage-ban megőrizve), drawer és toast
export default function ShopProvider({
  catalog,
  children,
}: {
  catalog: CatalogVariant[];
  children: React.ReactNode;
}) {
  const [cartLines, setCartLines] = useState<CartLine[]>([]);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hidratálás után betöltjük a mentett kosarat (a szerveren renderelt HTML mindig üres kosárral indul)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a localStorage csak a kliensen, hidratálás után olvasható
    setCartLines(readStoredCart());
    setStorageLoaded(true);
  }, []);

  // Minden változás után mentjük a kosarat, de csak a betöltés után, hogy az üres kezdőállapot ne írja felül
  useEffect(() => {
    // A betöltés előtti állapotot nem mentjük
    if (!storageLoaded) {
      return;
    }
    // Tiltott tárhely esetén a kosár csak a munkamenetben él
    try {
      window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartLines));
    } catch {
      // nincs teendő
    }
  }, [cartLines, storageLoaded]);

  // Kosártételek feloldása a katalógusból; a már nem létező cikkszámok kimaradnak
  const lines = useMemo<CartLineView[]>(() => {
    const bySku = new Map(catalog.map((variant) => [variant.sku, variant]));
    return cartLines.flatMap((line) => {
      const variant = bySku.get(line.sku);
      return variant ? [{ ...line, variant, lineTotalHuf: variant.priceHuf * line.qty }] : [];
    });
  }, [cartLines, catalog]);

  const cartQty = lines.reduce((sum, line) => sum + line.qty, 0);
  const cartTotalHuf = lines.reduce((sum, line) => sum + line.lineTotalHuf, 0);

  // Tétel mennyiségének módosítása a legfrissebb állapotból; 0-ra csökkentve a tétel kikerül
  const changeLineQty = useCallback((sku: string, delta: number) => {
    setCartLines((current) =>
      current
        .map((line) => (line.sku === sku ? { ...line, qty: Math.min(MAX_QTY, line.qty + delta) } : line))
        .filter((line) => line.qty > 0),
    );
  }, []);

  // „Kosárba teszem”: új tétel vagy +1 a meglévőhöz, majd megnyitja a drawert
  const addToCart = useCallback((sku: string) => {
    setCartLines((current) => {
      // Már kosárban lévő változatnál csak a mennyiség nő
      if (current.some((line) => line.sku === sku)) {
        return current.map((line) => (line.sku === sku ? { ...line, qty: Math.min(MAX_QTY, line.qty + 1) } : line));
      }
      return [...current, { sku, qty: 1 }];
    });
    setCartOpen(true);
  }, []);

  // Kosár ürítése (sikeres rendelés után)
  const clearCart = useCallback(() => {
    setCartLines([]);
  }, []);

  // Drawer megnyitása
  const openCart = useCallback(() => {
    setCartOpen(true);
  }, []);

  // Drawer bezárása
  const closeCart = useCallback(() => {
    setCartOpen(false);
  }, []);

  // Toast megjelenítése; az új üzenet újraindítja az eltűnési időzítőt
  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    // Az előző időzítőt töröljük, hogy egy korábbi üzenet ne rejtse el idő előtt az újat
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    toastTimer.current = setTimeout(() => setToastVisible(false), TOAST_DURATION_MS);
  }, []);

  // Escape billentyűre a kosár drawer bezárul
  useEffect(() => {
    // Billentyűfigyelő: csak az Escape zárja a drawert
    function onKeyDown(event: KeyboardEvent) {
      // Más billentyűk nem érintik a drawert
      if (event.key === "Escape") {
        setCartOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  // Nyitott drawer mellett a háttér nem görgethető
  useEffect(() => {
    document.body.style.overflow = cartOpen ? "hidden" : "";
  }, [cartOpen]);

  // Lecsatoláskor a függő toast időzítőt is töröljük
  useEffect(() => {
    return () => {
      // Csak akkor van mit törölni, ha volt már toast
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  const value = useMemo<ShopContextValue>(
    () => ({
      lines,
      cartQty,
      cartTotalHuf,
      cartOpen,
      toastMessage,
      toastVisible,
      addToCart,
      changeLineQty,
      clearCart,
      openCart,
      closeCart,
      showToast,
    }),
    [
      lines,
      cartQty,
      cartTotalHuf,
      cartOpen,
      toastMessage,
      toastVisible,
      addToCart,
      changeLineQty,
      clearCart,
      openCart,
      closeCart,
      showToast,
    ],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}
