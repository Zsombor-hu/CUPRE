import { signOutCustomer } from "@/services/auth-service";
import { okResponse } from "@/services/api-helpers";

// Kilépés: a munkamenet törlése az adatbázisból és a süti törlése
export async function POST() {
  await signOutCustomer();
  return okResponse();
}
