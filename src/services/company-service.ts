import "server-only";
import type { CompanyInfo, PaymentSettings, ShippingModeSettings, ShippingSettings } from "@/types/company";
import { readJsonData } from "@/services/data-paths";

// Kötelező szöveges mezők ellenőrzése egy objektumban
function hasStrings(value: unknown, keys: string[]): boolean {
  const record = value as Record<string, unknown>;
  return typeof record === "object" && record !== null && keys.every((key) => typeof record[key] === "string");
}

// Egy szállítási mód beállításának ellenőrzése
function isShippingMode(value: unknown): value is ShippingModeSettings {
  const mode = value as ShippingModeSettings;
  return (
    typeof mode === "object" &&
    mode !== null &&
    typeof mode.enabled === "boolean" &&
    Number.isInteger(mode.feeHuf) &&
    mode.feeHuf >= 0 &&
    typeof mode.deliveryDays === "string" &&
    (mode.trackingUrl === undefined || typeof mode.trackingUrl === "string")
  );
}

// A szállítási beállítások szerkezeti ellenőrzése
function isShippingSettings(value: unknown): value is ShippingSettings {
  const shipping = value as ShippingSettings;
  return (
    typeof shipping === "object" &&
    shipping !== null &&
    isShippingMode(shipping.home) &&
    typeof shipping.home.carrierName === "string" &&
    isShippingMode(shipping.foxpost) &&
    isShippingMode(shipping.mplPoint)
  );
}

// A fizetési beállítások szerkezeti ellenőrzése
function isPaymentSettings(value: unknown): value is PaymentSettings {
  const payments = value as PaymentSettings;
  return (
    typeof payments === "object" &&
    payments !== null &&
    typeof payments.card?.enabled === "boolean" &&
    (payments.card.provider === "mock" || payments.card.provider === "barion") &&
    typeof payments.transfer?.enabled === "boolean" &&
    hasStrings(payments.transfer, ["accountHolder", "bankName", "accountNumber", "iban", "swift"]) &&
    Number.isInteger(payments.transfer.dueDays) &&
    typeof payments.cod?.enabled === "boolean" &&
    Number.isInteger(payments.cod.feeHuf) &&
    payments.cod.feeHuf >= 0
  );
}

// A company.json szerkezeti ellenőrzése
function isCompanyInfo(value: unknown): value is CompanyInfo {
  const info = value as CompanyInfo;
  return (
    typeof info === "object" &&
    info !== null &&
    hasStrings(info.company, [
      "name",
      "seat",
      "postalAddress",
      "email",
      "phone",
      "registryNumber",
      "registryCourt",
      "taxNumber",
      "euVatNumber",
      "representative",
    ]) &&
    hasStrings(info.hosting, ["name", "address", "email"]) &&
    hasStrings(info.conciliationBody, ["name", "address", "email", "phone"]) &&
    hasStrings(info.dataProtectionAuthority, ["name", "address", "website"]) &&
    typeof info.shop === "object" &&
    typeof info.shop.liveOrders === "boolean" &&
    isShippingSettings(info.shop.shipping) &&
    typeof info.shop.legalUpdated === "string" &&
    isPaymentSettings(info.shop.payments)
  );
}

// A szolgáltató adatai és a webshop beállításai a környezet company.json fájljából
export function getCompanyInfo(): CompanyInfo {
  const data = readJsonData("company.json");
  // Hibás szerkezetnél a build/indulás azonnal jelezze a hibát
  if (!isCompanyInfo(data)) {
    throw new Error("A company.json szerkezete hibás.");
  }
  return data;
}

// A jogi szövegekben használható {helyettesítők} értékei
export function getLegalTokens(info: CompanyInfo = getCompanyInfo()): Record<string, string> {
  return {
    companyName: info.company.name,
    seat: info.company.seat,
    postalAddress: info.company.postalAddress,
    email: info.company.email,
    phone: info.company.phone,
    registryNumber: info.company.registryNumber,
    registryCourt: info.company.registryCourt,
    taxNumber: info.company.taxNumber,
    hostName: info.hosting.name,
    hostAddress: info.hosting.address,
    hostEmail: info.hosting.email,
    conciliationName: info.conciliationBody.name,
    conciliationAddress: info.conciliationBody.address,
    conciliationEmail: info.conciliationBody.email,
    conciliationPhone: info.conciliationBody.phone,
    naihName: info.dataProtectionAuthority.name,
    naihAddress: info.dataProtectionAuthority.address,
    naihWebsite: info.dataProtectionAuthority.website,
    updated: info.shop.legalUpdated,
  };
}
