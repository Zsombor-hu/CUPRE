import { deleteAccount } from "@/services/account-service";
import { currentAccountId, signOutCustomer } from "@/services/auth-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";

// Fiók törlése jelszó-megerősítéssel (GDPR törlési jog); a rendelések a megőrzési kötelezettség miatt megmaradnak
export async function POST(request: Request) {
  const accountId = await currentAccountId();
  // Csak belépett ügyfél törölheti a saját fiókját
  if (accountId === null) {
    return formError("unauthorized", 401);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const result = deleteAccount(accountId, body);
  // Hibás jelszó
  if (!result.ok) {
    return errorResponse(result.errors);
  }
  await signOutCustomer();
  return okResponse();
}
