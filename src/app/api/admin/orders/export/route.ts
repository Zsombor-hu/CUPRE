import { isAdmin } from "@/services/auth-service";
import { filterFromUrl, ordersCsv } from "@/services/order-admin-service";
import { formError } from "@/services/api-helpers";

// Admin: rendelések CSV-ben, a listával azonos szűrőkkel
export async function GET(request: Request) {
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  const date = new Date().toISOString().slice(0, 10);
  return new Response(ordersCsv(filterFromUrl(new URL(request.url))), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cupre-rendelesek-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
