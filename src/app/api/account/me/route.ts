import { getAccountOverview, updateProfile } from "@/services/account-service";
import { currentAccountId } from "@/services/auth-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";
import type { AccountOverview } from "@/types/account";

// A belépett ügyfél profilja és rendelései; belépés nélkül 401
export async function GET() {
  const accountId = await currentAccountId();
  const overview = accountId === null ? null : getAccountOverview(accountId);
  // Nincs (érvényes) belépés
  if (!overview) {
    return formError("unauthorized", 401);
  }
  return Response.json(overview satisfies AccountOverview, { headers: { "Cache-Control": "no-store" } });
}

// Profil (szállítási adatok, nyelv) és hírlevél-beállítás módosítása
export async function PATCH(request: Request) {
  const accountId = await currentAccountId();
  // Csak belépett ügyfél módosíthat
  if (accountId === null) {
    return formError("unauthorized", 401);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const result = updateProfile(accountId, body);
  // Validációs hiba
  if (!result.ok) {
    return errorResponse(result.errors);
  }
  return okResponse();
}
