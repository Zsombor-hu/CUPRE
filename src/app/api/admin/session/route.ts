import { adminPasswordConfigured, isAdmin } from "@/services/auth-service";

// Admin munkamenet állapota: be van-e kapcsolva az admin felület, és belépett-e a látogató
export async function GET() {
  const configured = adminPasswordConfigured();
  const authenticated = configured && (await isAdmin());
  return Response.json({ configured, authenticated }, { headers: { "Cache-Control": "no-store" } });
}
