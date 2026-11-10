import { isAdmin } from "@/services/auth-service";
import { filterFromUrl, ordersCsv, ordersXlsx } from "@/services/order-admin-service";
import { formError } from "@/services/api-helpers";

// Excel (.xlsx) MIME-típusa
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Admin: rendelések CSV-ben vagy Excelben (?format=xlsx), a listával azonos szűrőkkel
export async function GET(request: Request) {
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  const url = new URL(request.url);
  const date = new Date().toISOString().slice(0, 10);
  const filter = filterFromUrl(url);
  // Excel formátum
  if (url.searchParams.get("format") === "xlsx") {
    return new Response(new Uint8Array(ordersXlsx(filter)), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="cupre-rendelesek-${date}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(ordersCsv(filter), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cupre-rendelesek-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
