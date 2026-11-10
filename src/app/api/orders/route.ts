import { placeOrder } from "@/services/order-service";
import { currentAccountId } from "@/services/auth-service";
import { getAccountEmail } from "@/services/account-service";
import type { OrderErrorResponse, OrderResponse } from "@/types/order";

// Rendelés leadása: a törzset validálja, az ügyfelet és a rendelést a környezet SQLite adatbázisába menti.
// Hibás kérésre 400 mezőnkénti hibákkal; sikeres mentésre 201 a rendelésszámmal, a fizetési teendőkkel,
// és kártyás fizetésnél a fizetőoldal címével (redirectUrl)
export async function POST(request: Request) {
  let body: unknown;
  // Nem JSON törzs esetén azonnal 400-at adunk
  try {
    body = await request.json();
  } catch {
    return Response.json({ errors: { form: "invalidRequest" } } satisfies OrderErrorResponse, { status: 400 });
  }
  // Belépett ügyfélnél a rendelés a fiókhoz kötődik, az e-mail cím a fiók címe
  const accountId = await currentAccountId();
  const email = accountId === null ? null : getAccountEmail(accountId);
  const result = await placeOrder(body, accountId !== null && email ? { id: accountId, email } : null);
  // Validációs hiba: a mezőnkénti üzeneteket az űrlap jeleníti meg
  if (!result.ok) {
    return Response.json({ errors: result.errors } satisfies OrderErrorResponse, { status: 400 });
  }
  return Response.json(result.value satisfies OrderResponse, { status: 201 });
}
