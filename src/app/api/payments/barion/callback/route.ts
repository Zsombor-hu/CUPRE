import { handleBarionCallback } from "@/services/payment-service";

// A fizetési azonosító kiolvasása a Barion értesítéséből: query-ből, form- vagy JSON-törzsből (paymentId / PaymentId)
async function readPaymentId(request: Request): Promise<string> {
  const url = new URL(request.url);
  const fromQuery = url.searchParams.get("paymentId") ?? url.searchParams.get("PaymentId");
  // A legegyszerűbb eset: query paraméter
  if (fromQuery) {
    return fromQuery;
  }
  const raw = await request.text();
  // JSON törzs
  try {
    const json = JSON.parse(raw) as Record<string, unknown>;
    const value = json.paymentId ?? json.PaymentId;
    // Csak szöveges azonosítót fogadunk el
    if (typeof value === "string") {
      return value;
    }
  } catch {
    // nem JSON – form-kódolt törzsként próbáljuk
  }
  const form = new URLSearchParams(raw);
  return form.get("paymentId") ?? form.get("PaymentId") ?? "";
}

// Barion szerver-szerver értesítés (callback): a tartalmában nem bízunk, csak a fizetési azonosítót vesszük át,
// és az állapotot a Barion API-tól kérdezzük le. Ismert fizetésnél 200-zal válaszolunk, hogy a Barion ne ismételje.
export async function POST(request: Request) {
  const paymentId = (await readPaymentId(request)).slice(0, 100);
  // Azonosító nélkül nincs mit feldolgozni
  if (!paymentId) {
    return new Response("missing paymentId", { status: 400 });
  }
  // Átmeneti hibánál 500-at adunk, így a Barion később újrapróbálja az értesítést
  try {
    const known = await handleBarionCallback(paymentId);
    return new Response(known ? "OK" : "unknown payment", { status: known ? 200 : 404 });
  } catch (error) {
    console.error("Barion callback feldolgozási hiba:", error);
    return new Response("error", { status: 500 });
  }
}
