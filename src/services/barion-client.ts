import "server-only";
import type { Locale } from "@/lib/i18n";
import type { PaymentStatus } from "@/types/order";

// Barion Smart Gateway REST kliens (új függőség nélkül, fetch-csel). A végpontok és mezők a Barion hivatalos
// PHP könyvtárával (github.com/barion/barion-web-php, BarionClient.php) egyeztetve:
//   fizetés indítása:    POST {api}/v2/Payment/Start
//   állapot lekérdezése: GET  {api}/v4/Payment/{paymentId}/PaymentState
//   azonosítás:          x-pos-key fejléc (a v2 Start törzsében POSKey mező is)
// A kártyaadatot a vásárló a Barion fizetőoldalán adja meg; a CUPRÉ szerverére soha nem kerül.

// Barion környezetek alapcímei
const HOSTS = {
  sandbox: { api: "https://api.test.barion.com", web: "https://secure.test.barion.com/Pay" },
  production: { api: "https://api.barion.com", web: "https://secure.barion.com/Pay" },
} as const;

// A Barion felület nyelve a rendelés nyelvéből
const LOCALES: Record<Locale, string> = { hu: "hu-HU", en: "en-US", de: "de-DE" };

// Barion beállítások a környezeti változókból
export type BarionConfig = {
  posKey: string;
  payee: string;
  api: string;
  web: string;
};

// A Barion beállítások, vagy null, ha hiányos (ilyenkor a kártyás fizetés nem ajánlható fel)
export function barionConfig(): BarionConfig | null {
  const posKey = process.env.BARION_POS_KEY ?? "";
  const payee = process.env.BARION_PAYEE ?? "";
  const host = process.env.BARION_ENVIRONMENT === "production" ? HOSTS.production : HOSTS.sandbox;
  // Kulcs vagy kedvezményezett nélkül nincs Barion fizetés
  if (!posKey || !payee) {
    return null;
  }
  return { posKey, payee, ...host };
}

// Egy fizetési tétel a Barion felé (név, mennyiség, egységár)
export type BarionItem = {
  name: string;
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  sku: string;
};

// Fizetés indításához szükséges adatok
export type BarionStartInput = {
  orderId: number;
  attempt: string;
  totalHuf: number;
  items: BarionItem[];
  payerEmail: string;
  lang: Locale;
  redirectUrl: string;
  callbackUrl: string;
};

// A Barion válaszának hibalistája
type BarionErrors = { Title?: string; Description?: string; ErrorCode?: string }[];

// Szöveg levágása a Barion mezőhossz-korlátaihoz (óvatos felső korlát)
function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

// Fizetés indítása; siker esetén a Barion fizetési azonosító és a fizetőoldal címe
export async function startBarionPayment(
  config: BarionConfig,
  input: BarionStartInput,
): Promise<{ paymentId: string; gatewayUrl: string; raw: unknown }> {
  const body = {
    POSKey: config.posKey,
    PaymentType: "Immediate",
    PaymentWindow: "00:30:00",
    FundingSources: ["All"],
    PaymentRequestId: `CUPRE-${input.orderId}-${input.attempt}`,
    PayerHint: input.payerEmail,
    Locale: LOCALES[input.lang],
    Currency: "HUF",
    OrderNumber: String(input.orderId),
    RedirectUrl: input.redirectUrl,
    CallbackUrl: input.callbackUrl,
    Transactions: [
      {
        POSTransactionId: `CUPRE-${input.orderId}-${input.attempt}`,
        Payee: config.payee,
        Total: input.totalHuf,
        Comment: `CUPRÉ #${input.orderId}`,
        Items: input.items.map((item) => ({
          Name: clip(item.name, 250),
          Description: clip(item.description, 500),
          Quantity: item.quantity,
          Unit: item.unit,
          UnitPrice: item.unitPrice,
          ItemTotal: item.unitPrice * item.quantity,
          SKU: clip(item.sku, 100),
        })),
      },
    ],
  };
  const response = await fetch(`${config.api}/v2/Payment/Start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-pos-key": config.posKey },
    body: JSON.stringify(body),
  });
  const raw = (await response.json().catch(() => null)) as {
    PaymentId?: string;
    GatewayUrl?: string;
    Errors?: BarionErrors;
  } | null;
  // Hibás válasz: a Barion hibaüzeneteit naplózásra továbbadjuk
  if (!response.ok || !raw?.PaymentId || (raw.Errors && raw.Errors.length > 0)) {
    const detail = raw?.Errors?.map((error) => `${error.ErrorCode}: ${error.Title}`).join("; ") ?? response.statusText;
    throw new Error(`Barion Payment/Start hiba (${response.status}): ${detail}`);
  }
  return {
    paymentId: raw.PaymentId,
    gatewayUrl: raw.GatewayUrl ?? `${config.web}?id=${encodeURIComponent(raw.PaymentId)}`,
    raw,
  };
}

// Barion fizetési állapot → a rendelés fizetési állapota
export function mapBarionStatus(status: string): PaymentStatus {
  // Csak a végleges Barion állapotok változtatják meg a rendelést, a többi „folyamatban” marad
  switch (status) {
    case "Succeeded":
      return "paid";
    case "Canceled":
      return "canceled";
    case "Expired":
      return "expired";
    case "Failed":
      return "failed";
    default:
      // Prepared, Started, InProgress, Waiting, Reserved, Authorized, PartiallySucceeded: még nincs végeredmény
      return "pending";
  }
}

// Fizetési állapot lekérdezése a Barion API-tól (a callback tartalmában nem bízunk, mindig innen kérdezünk)
export async function getBarionPaymentState(
  config: BarionConfig,
  paymentId: string,
): Promise<{ status: PaymentStatus; barionStatus: string; raw: unknown }> {
  const response = await fetch(`${config.api}/v4/Payment/${encodeURIComponent(paymentId)}/PaymentState`, {
    headers: { "x-pos-key": config.posKey },
    cache: "no-store",
  });
  const raw = (await response.json().catch(() => null)) as { Status?: string; Errors?: BarionErrors } | null;
  // Sikertelen lekérdezés: a hívó változatlanul hagyja a rendelést
  if (!response.ok || !raw?.Status) {
    throw new Error(`Barion PaymentState hiba (${response.status})`);
  }
  return { status: mapBarionStatus(raw.Status), barionStatus: raw.Status, raw };
}
