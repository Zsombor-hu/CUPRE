"use client";

import { useContext } from "react";
import { ShopContext } from "@/components/cupre/shop-provider";
import type { ShopContextValue } from "@/types/cupre";

// A ShopProvider állapotának elérése; provider nélkül fejlesztői hibát dob
export function useShop(): ShopContextValue {
  const context = useContext(ShopContext);
  // Provider nélküli használat programozási hiba, ezt azonnal jelezzük
  if (!context) {
    throw new Error("A useShop csak ShopProvider-en belül használható.");
  }
  return context;
}
