import { changePassword } from "@/services/account-service";
import { currentAccountId, signInCustomer } from "@/services/auth-service";
import { errorResponse, formError, okResponse, readJson } from "@/services/api-helpers";

// Jelszócsere: a régi jelszó ellenőrzése után minden munkamenet megszűnik, ezen az eszközön új munkamenet indul
export async function POST(request: Request) {
  const accountId = await currentAccountId();
  // Csak belépett ügyfél cserélhet jelszót
  if (accountId === null) {
    return formError("unauthorized", 401);
  }
  const body = await readJson(request);
  // Nem JSON törzs
  if (body === null) {
    return formError("invalidRequest");
  }
  const result = changePassword(accountId, body);
  // Hibás jelenlegi jelszó vagy gyenge új jelszó
  if (!result.ok) {
    return errorResponse(result.errors);
  }
  await signInCustomer(accountId);
  return okResponse();
}
