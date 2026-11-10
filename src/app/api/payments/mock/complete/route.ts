import { completeMockPayment } from "@/services/payment-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record, text } from "@/lib/validation";

// Teszt-szolgáltató: a teszt fizetőoldalon választott kimenet rögzítése. Production környezetben és nem mock
// szolgáltatónál tiltott (403).
export async function POST(request: Request) {
  const body = record(await readJson(request));
  const outcome = body.outcome === "paid" || body.outcome === "failed" || body.outcome === "canceled" ? body.outcome : null;
  // Ismeretlen kimenet
  if (!outcome) {
    return formError("invalidRequest");
  }
  // Csak fejlesztői, mock módban és érvényes tokennel
  if (!completeMockPayment(Number(body.order), text(body.token, 100), outcome)) {
    return formError("unauthorized", 403);
  }
  return okResponse();
}
