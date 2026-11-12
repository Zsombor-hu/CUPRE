import type { Dictionary } from "@/lib/i18n";

// Felületi beállítások; a szövegek a src/data/i18n szótárakban, az üzleti adatok a src/data/<környezet> JSON fájljaiban vannak

// A toast üzenetek ideje ezredmásodpercben, az eredeti prototípussal egyezően
export const TOAST_DURATION_MS = 3800;

// A kosár kulcsa a böngésző localStorage-ában (nyelvfüggetlen, cikkszámokat tárol)
export const CART_STORAGE_KEY = "cupre-cart";

// Főmenü pontjai: útvonal (nyelvi előtag nélkül) és a felirat kulcsa a szótár nav részében
export const MAIN_NAV: { path: string; labelKey: keyof Dictionary["nav"] }[] = [
  { path: "/#top", labelKey: "home" },
  { path: "/termekek", labelKey: "products" },
  { path: "/#rez", labelKey: "copper" },
  { path: "/#technologia", labelKey: "technology" },
  { path: "/#hasznalat", labelKey: "usage" },
  { path: "/#marka", labelKey: "about" },
  { path: "/#gyik", labelKey: "faq" },
];

// Képek egységes elérési útjai a public/images mappában (a termékképek útvonala a products.json-ban van)
export const IMAGES = {
  logo: "/images/logo-moon.svg",
  giftBanner: "/images/gift-banner.png",
  storyTexture: "/images/story-texture.webp",
  storyHome: "/images/story-home.webp",
  storyProtection: "/images/story-protection.webp",
  technology: "/images/technology-layer.png",
  care: "/images/care-bedroom.webp",
  packaging: "/images/product-cupre-original.webp",
} as const;
