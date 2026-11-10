import type { LocalizedText } from "@/lib/i18n";

// Termékosztály: első (hibátlan) vagy másodosztályú minőség
export type ProductGrade = "first" | "second";

// Változat a products.json-ban: méret × osztály kombináció saját cikkszámmal, árral és háromnyelvű ármegjegyzéssel
export type ProductVariantData = {
  sku: string;
  size: string;
  grade: ProductGrade;
  priceHuf: number;
  priceNote: LocalizedText;
};

// Gazdasági szereplő (gyártó, EU-s felelős személy) neve és elérhetősége
export type EconomicOperator = {
  name: string;
  address: string;
};

// Kötelező termékadatok: textil szálösszetétel (EU 1007/2011), kezelés, termékbiztonság (GPSR, EU 2023/988)
export type ProductInfoData = {
  composition: LocalizedText;
  care: LocalizedText;
  manufacturer: EconomicOperator;
  euResponsible: EconomicOperator | null;
  productId: string;
  safety: LocalizedText;
};

// A kötelező termékadatok egy nyelvre feloldva
export type ProductInfo = {
  composition: string;
  care: string;
  manufacturer: EconomicOperator;
  euResponsible: EconomicOperator | null;
  productId: string;
  safety: string;
};

// Termék a products.json-ban; a szöveges mezők háromnyelvűek
export type ProductData = {
  slug: string;
  featured: boolean;
  image: string;
  imageWidth: number;
  imageHeight: number;
  tag: string;
  name: LocalizedText;
  subtitle: LocalizedText;
  imageAlt: LocalizedText;
  description: LocalizedText;
  points: { icon: string; label: LocalizedText }[];
  disclaimer: LocalizedText;
  variants: ProductVariantData[];
  productInfo: ProductInfoData;
};

// Egy nyelvre feloldott változat
export type ProductVariant = Omit<ProductVariantData, "priceNote"> & {
  priceNote: string;
};

// Termék kiemelt jellemzője (ikon + rövid felirat)
export type ProductPoint = {
  icon: string;
  label: string;
};

// Egy nyelvre feloldott termék (ezt kapják a komponensek)
export type Product = {
  slug: string;
  name: string;
  subtitle: string;
  featured: boolean;
  image: string;
  imageWidth: number;
  imageHeight: number;
  imageAlt: string;
  tag: string;
  description: string;
  points: ProductPoint[];
  disclaimer: string;
  variants: ProductVariant[];
  productInfo: ProductInfo;
};

// Kosárban és rendelésben használt, termékadatokkal kiegészített változat
export type CatalogVariant = ProductVariant & {
  productSlug: string;
  productName: string;
  image: string;
};
