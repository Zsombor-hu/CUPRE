// Fix összegű kupon (az admin felületen kezelve); az érvényesség napra pontos (ÉÉÉÉ-HH-NN, budapesti idő)
export type Coupon = {
  id: number;
  code: string;
  amountHuf: number;
  validFrom: string | null;
  validUntil: string | null;
  active: boolean;
  note: string;
  usedCount: number;
  createdAt: string;
};

// Kupon beváltásának hibakódjai (a megjelenített szöveg a kliens szótárából jön)
export type CouponErrorCode = "couponInvalid" | "couponNotYetValid" | "couponExpired";

// Sikeres ellenőrzés válasza a pénztárnak
export type CouponCheckResponse = {
  code: string;
  amountHuf: number;
};
