import "server-only";
import type { AccountErrorCode, AccountErrorResponse } from "@/types/account";

// JSON törzs beolvasása; hibás vagy hiányzó törzsnél null
export async function readJson(request: Request): Promise<unknown | null> {
  // Nem JSON törzs esetén null-t adunk, a hívó 400-at válaszol
  try {
    return await request.json();
  } catch {
    return null;
  }
}

// Mezőnkénti hibakódokkal válasz (alapértelmezésben 400)
export function errorResponse(errors: Record<string, AccountErrorCode>, status = 400): Response {
  return Response.json({ errors } satisfies AccountErrorResponse, { status });
}

// Rövidítés: egyetlen, űrlapszintű hibakód
export function formError(code: AccountErrorCode, status = 400): Response {
  return errorResponse({ form: code }, status);
}

// Sikeres, adat nélküli válasz
export function okResponse(): Response {
  return Response.json({ ok: true });
}
