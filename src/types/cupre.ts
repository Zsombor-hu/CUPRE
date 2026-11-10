import type { CatalogVariant } from "@/types/product";

// Navigációs link a fejlécben, a mobilmenüben és a láblécben
export type NavLink = {
  href: string;
  label: string;
};

// Kosártétel: változat cikkszáma és darabszáma (localStorage-ban is így tároljuk)
export type CartLine = {
  sku: string;
  qty: number;
};

// Kosártétel a katalógusból feloldott termékadatokkal a megjelenítéshez
export type CartLineView = CartLine & {
  variant: CatalogVariant;
  lineTotalHuf: number;
};

// A kosarat, a drawert és a toast üzenetet kezelő context értéke
export type ShopContextValue = {
  lines: CartLineView[];
  cartQty: number;
  cartTotalHuf: number;
  cartOpen: boolean;
  toastMessage: string;
  toastVisible: boolean;
  addToCart: (sku: string) => void;
  changeLineQty: (sku: string, delta: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  showToast: (message: string) => void;
};
