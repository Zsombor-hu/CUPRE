import type { Locale } from "@/lib/i18n";
import type { ProductGrade } from "@/types/product";
import type { PaymentMethod, PaymentStatus, ShippingMethod } from "@/types/order";

// A fiókhoz tartozó, szerkeszthető szállítási adatok
export type AccountProfileInput = {
  name: string;
  phone: string;
  postcode: string;
  city: string;
  address: string;
};

// A belépett ügyfél profilja
export type AccountProfile = AccountProfileInput & {
  email: string;
  lang: Locale;
  newsletter: NewsletterStatus | null;
  createdAt: string;
};

// Korábbi rendelés tétele
export type AccountOrderItem = {
  productName: string;
  size: string;
  grade: ProductGrade;
  qty: number;
  unitPriceHuf: number;
};

// Korábbi rendelés összefoglalója a „Rendeléseim” listában
export type AccountOrder = {
  id: number;
  createdAt: string;
  status: string;
  totalHuf: number;
  paymentMethod: PaymentMethod;
  paymentStatus: PaymentStatus;
  shippingMethod: ShippingMethod;
  pickupPointName: string | null;
  items: AccountOrderItem[];
};

// A GET /api/account/me válasza
export type AccountOverview = {
  profile: AccountProfile;
  orders: AccountOrder[];
};

// Hírlevél-feliratkozás állapota
export type NewsletterStatus = "pending" | "active" | "unsubscribed";

// Hírlevél-feliratkozás forrása
export type NewsletterSource = "form" | "checkout" | "account";

// Feliratkozó az admin listában
export type NewsletterSubscriber = {
  id: number;
  email: string;
  name: string;
  lang: string;
  status: NewsletterStatus;
  source: NewsletterSource;
  consentAt: string;
  confirmedAt: string | null;
  unsubscribedAt: string | null;
  createdAt: string;
};

// Fiók és hírlevél API-k hibakódjai; a megjelenített szöveg a kliens szótárából jön
export type AccountErrorCode =
  | "required"
  | "invalidEmail"
  | "weakPassword"
  | "passwordMismatch"
  | "emailTaken"
  | "invalidCredentials"
  | "invalidCaptcha"
  | "wrongPassword"
  | "invalidToken"
  | "consentRequired"
  | "tooManyAttempts"
  | "unauthorized"
  | "accountDisabled"
  | "invalidRequest";

// Hibás kérés válasza: mezőnkénti hibakódok
export type AccountErrorResponse = {
  errors: Record<string, AccountErrorCode>;
};
