import type { Locale } from "@/lib/i18n";

// A pénztár űrlapon megadott ügyféladatok
export type CustomerInput = {
  name: string;
  email: string;
  phone: string;
  postcode: string;
  city: string;
  address: string;
};

// Rendelési tétel: csak cikkszám és darabszám, az árat a szerver számolja
export type OrderItemInput = {
  sku: string;
  qty: number;
};

// A POST /api/orders kérés törzse; a lang a rendelés nyelve (a későbbi visszaigazoló levélhez)
export type OrderRequest = {
  customer: CustomerInput;
  items: OrderItemInput[];
  note: string;
  // Az ÁSZF (és az elállási tájékoztató) elfogadása – a rendelés feltétele
  acceptTerms: boolean;
  // Opcionális hírlevél-feliratkozás a pénztárban (dupla megerősítéssel)
  newsletter?: boolean;
  // Választott fizetési mód (csak bekapcsolt mód fogadható el)
  paymentMethod?: PaymentMethod;
  // Választott szállítási mód és (átvételi pontos módnál) a pont
  shippingMethod?: ShippingMethod;
  pickupPoint?: PickupPoint;
  // Beváltandó kuponkód (opcionális; a szerver újra ellenőrzi)
  couponCode?: string;
  lang: Locale;
};

// Fizetési mód: bankkártya, banki átutalás, utánvét, vagy „none” (ha egy mód sincs bekapcsolva)
export type PaymentMethod = "card" | "transfer" | "cod" | "none";

// A rendelés fizetési állapota
export type PaymentStatus =
  | "not_required"
  | "pending"
  | "awaiting_transfer"
  | "awaiting_cod"
  | "paid"
  | "failed"
  | "canceled"
  | "expired";

// A pénztárban választható fizetési mód (a kliens csak a bekapcsoltakat kapja meg)
export type PaymentOption = {
  method: Exclude<PaymentMethod, "none">;
  feeHuf: number;
  provider?: "mock" | "barion";
};

// Szállítási mód: házhozszállítás, Foxpost automata, MPL PostaPont/automata, vagy „none” (ha egy sincs bekapcsolva)
export type ShippingMethod = "home" | "foxpost" | "mpl_point" | "none";

// Kiválasztott átvételi pont (Foxpost automata vagy MPL pont)
export type PickupPoint = {
  id: string;
  name: string;
  address: string;
};

// A pénztárban választható szállítási mód; a pontválasztó módja: Foxpost térkép vagy kézi megadás (MPL)
export type ShippingOption = {
  method: Exclude<ShippingMethod, "none">;
  feeHuf: number;
  deliveryDays: string;
  carrierName?: string;
  picker: "foxpost-map" | "manual" | null;
};

// A rendelés szállítási adatai a visszaigazoláshoz és a levélhez
export type ShippingSummary = {
  method: ShippingMethod;
  feeHuf: number;
  deliveryDays: string;
  carrierName?: string;
  pickupPoint?: PickupPoint;
};

// A pénztár a company.json shop beállításaiból ennyit kap meg
export type CheckoutSettings = {
  liveOrders: boolean;
  shippingOptions: ShippingOption[];
  paymentOptions: PaymentOption[];
};

// Banki átutalás adatai a visszaigazoláshoz
export type TransferDetails = {
  accountHolder: string;
  bankName: string;
  accountNumber: string;
  iban: string;
  swift: string;
  dueDays: number;
  reference: string;
};

// A fizetési eredményoldal / visszaigazolás adatai (csak a rendeléshez kiadott tokennel kérdezhető le)
export type PaymentSummary = {
  orderId: number;
  totalHuf: number;
  method: PaymentMethod;
  status: PaymentStatus;
  transfer?: TransferDetails;
};

// Sikeres rendelés válasza: kártyánál átirányítási cím, egyébként a fizetési teendők; a token a rendelés
// fizetési állapotának későbbi lekérdezéséhez kell (eredményoldal, újrapróbálás)
export type OrderResponse = {
  orderId: number;
  totalHuf: number;
  token: string;
  redirectUrl?: string;
  payment: PaymentSummary;
  shipping: ShippingSummary;
  // Beváltott kupon és a ténylegesen levont összeg
  couponCode?: string;
  discountHuf: number;
};

// Validációs hibakódok; a megjelenített szöveg a kliens szótárából (checkout.errors) jön
export type OrderErrorCode =
  | "required"
  | "invalidEmail"
  | "termsRequired"
  | "emptyCart"
  | "invalidItems"
  | "outOfStock"
  | "invalidPaymentMethod"
  | "invalidShippingMethod"
  | "pickupPointRequired"
  | "couponInvalid"
  | "couponNotYetValid"
  | "couponExpired"
  | "paymentUnavailable"
  | "invalidRequest";

// Hibás kérés válasza: mezőnkénti hibakódok
export type OrderErrorResponse = {
  errors: Record<string, OrderErrorCode>;
};
