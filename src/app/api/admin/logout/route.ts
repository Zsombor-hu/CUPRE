import { signOutAdmin } from "@/services/auth-service";
import { okResponse } from "@/services/api-helpers";

// Admin kilépés
export async function POST() {
  await signOutAdmin();
  return okResponse();
}
