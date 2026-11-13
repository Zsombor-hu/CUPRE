import "server-only";
import { getCompanyInfo } from "@/services/company-service";
import { getCustomerDb } from "@/services/customer-db";
import { record, text } from "@/lib/validation";
import type { OrderErrorCode, PickupPoint, ShippingMethod, ShippingOption, ShippingSummary } from "@/types/order";

// A pénztárban választható szállítási módok (csak a bekapcsoltak), a beállított díjjal és pontválasztóval
export function shippingOptions(): ShippingOption[] {
  const shipping = getCompanyInfo().shop.shipping;
  const options: ShippingOption[] = [];
  // Házhozszállítás futárral
  if (shipping.home.enabled) {
    options.push({
      method: "home",
      feeHuf: shipping.home.feeHuf,
      deliveryDays: shipping.home.deliveryDays,
      carrierName: shipping.home.carrierName,
      picker: null,
    });
  }
  // Foxpost csomagautomata – térképes automatakereső
  if (shipping.foxpost.enabled) {
    options.push({ method: "foxpost", feeHuf: shipping.foxpost.feeHuf, deliveryDays: shipping.foxpost.deliveryDays, picker: "foxpost-map" });
  }
  // MPL PostaPont / automata – a pont kézi megadása (hivatalos beágyazható MPL pontkereső még nincs bekötve)
  if (shipping.mplPoint.enabled) {
    options.push({ method: "mpl_point", feeHuf: shipping.mplPoint.feeHuf, deliveryDays: shipping.mplPoint.deliveryDays, picker: "manual" });
  }
  return options;
}

// Átvételi pont beolvasása a kérésből (azonosító opcionális a kézi megadásnál; név és cím kötelező)
function readPickupPoint(value: unknown): PickupPoint | null {
  const raw = record(value);
  const point = { id: text(raw.id, 60), name: text(raw.name, 150), address: text(raw.address, 250) };
  return point.name && point.address ? point : null;
}

// A választott szállítási mód ellenőrzése: csak bekapcsolt mód; átvételi pontos módnál kötelező a pont.
// A díjat mindig a szerver beállításából vesszük, a kliens által küldött értéket figyelmen kívül hagyjuk.
export function resolveShipping(
  requestedMethod: unknown,
  requestedPoint: unknown,
): { ok: true; method: ShippingMethod; feeHuf: number; pickupPoint: PickupPoint | null } | { ok: false; error: OrderErrorCode } {
  const options = shippingOptions();
  // Egy szállítási mód sincs bekapcsolva: díj nélkül, egyeztetéssel (a korábbi működés)
  if (options.length === 0) {
    return { ok: true, method: "none", feeHuf: 0, pickupPoint: null };
  }
  const option = options.find((candidate) => candidate.method === requestedMethod);
  // Kikapcsolt vagy ismeretlen mód
  if (!option) {
    return { ok: false, error: "invalidShippingMethod" };
  }
  // Házhozszállításnál nincs átvételi pont
  if (option.picker === null) {
    return { ok: true, method: option.method, feeHuf: option.feeHuf, pickupPoint: null };
  }
  const point = readPickupPoint(requestedPoint);
  // Átvételi pontos mód pont nélkül
  if (!point) {
    return { ok: false, error: "pickupPointRequired" };
  }
  return { ok: true, method: option.method, feeHuf: option.feeHuf, pickupPoint: point };
}

// A rendelés szállítási összefoglalója (visszaigazolás, levél, eredményoldal)
export function shippingSummaryById(orderId: number): ShippingSummary | null {
  const row = getCustomerDb()
    .prepare(
      `SELECT shipping_method AS method, shipping_fee_huf AS feeHuf, pickup_point_id AS pointId,
         pickup_point_name AS pointName, pickup_point_address AS pointAddress
       FROM orders WHERE id = ?`,
    )
    .get(orderId) as
    | { method: ShippingMethod; feeHuf: number; pointId: string | null; pointName: string | null; pointAddress: string | null }
    | undefined;
  // Ismeretlen rendelés
  if (!row) {
    return null;
  }
  const settings = getCompanyInfo().shop.shipping;
  const deliveryDays =
    row.method === "home"
      ? settings.home.deliveryDays
      : row.method === "foxpost"
        ? settings.foxpost.deliveryDays
        : row.method === "mpl_point"
          ? settings.mplPoint.deliveryDays
          : "";
  return {
    method: row.method,
    feeHuf: row.feeHuf,
    deliveryDays,
    carrierName: row.method === "home" ? settings.home.carrierName : undefined,
    pickupPoint: row.pointName ? { id: row.pointId ?? "", name: row.pointName, address: row.pointAddress ?? "" } : undefined,
  };
}

// Beépített csomagkövetési címek ({code}: a követési szám); a company.json trackingUrl mezője felülírja
const DEFAULT_TRACKING_URLS: Partial<Record<ShippingMethod, string>> = {
  foxpost: "https://foxpost.hu/csomagkovetes/?code={code}",
  mpl_point: "https://www.posta.hu/nyomkovetes/nyitooldal?searchvalue={code}",
};

// Csomagkövetési link a szállítási mód és a követési szám alapján; ha a módhoz nincs cím, null
export function trackingUrl(method: ShippingMethod, code: string | null): string | null {
  // Követési szám nélkül nincs link
  if (!code) {
    return null;
  }
  const settings = getCompanyInfo().shop.shipping;
  const configured =
    method === "home" ? settings.home.trackingUrl : method === "foxpost" ? settings.foxpost.trackingUrl : method === "mpl_point" ? settings.mplPoint.trackingUrl : undefined;
  const template = configured || DEFAULT_TRACKING_URLS[method];
  return template ? template.replace("{code}", encodeURIComponent(code)) : null;
}
