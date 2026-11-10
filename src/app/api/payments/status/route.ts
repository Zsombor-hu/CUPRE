import { paymentSummaryFor } from "@/services/payment-service";
import { formError } from "@/services/api-helpers";

// A fizetési eredményoldal lekérdezése: csak a rendeléshez kiadott tokennel; függő kártyás fizetésnél
// a szerviz előbb frissít a szolgáltatótól
export async function GET(request: Request) {
  const url = new URL(request.url);
  const summary = await paymentSummaryFor(Number(url.searchParams.get("order")), url.searchParams.get("token") ?? "");
  // Rossz token vagy ismeretlen rendelés: nem adunk ki semmilyen adatot
  if (!summary) {
    return formError("invalidToken", 404);
  }
  return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
}
