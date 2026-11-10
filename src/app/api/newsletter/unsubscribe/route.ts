import { unsubscribeByToken } from "@/services/newsletter-service";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record, text } from "@/lib/validation";

// Leiratkozás a levélben kapott tokennel (bejelentkezés nélkül)
export async function POST(request: Request) {
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  // Ismeretlen token
  if (!unsubscribeByToken(text(record(body).token, 100))) {
    return formError("invalidToken");
  }
  return okResponse();
}
