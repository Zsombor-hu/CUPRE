import { confirmSubscription } from "@/services/newsletter-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record, text } from "@/lib/validation";

// Feliratkozás megerősítése a levélben kapott tokennel (dupla opt-in második lépése)
export async function POST(request: Request) {
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  // Ismeretlen vagy már leiratkozott tokennel nem erősíthető meg
  if (!confirmSubscription(text(record(body).token, 100))) {
    return formError("invalidToken");
  }
  return okResponse();
}
