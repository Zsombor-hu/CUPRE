import { isAdmin } from "@/services/auth-service";
import { subscribersCsv, subscribersXlsx } from "@/services/newsletter-service";
import { formError } from "@/services/api-helpers";
import type { NewsletterStatus } from "@/types/account";

// Excel (.xlsx) MIME-típusa
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

// Admin: feliratkozók CSV-ben vagy Excelben (?format=xlsx); alapértelmezésben csak az aktívak – ezeknek szabad hírlevelet küldeni
export async function GET(request: Request) {
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  const url = new URL(request.url);
  const param = url.searchParams.get("status") ?? "active";
  const status: NewsletterStatus | undefined =
    param === "pending" || param === "active" || param === "unsubscribed" ? param : undefined;
  const date = new Date().toISOString().slice(0, 10);
  const base = `cupre-hirlevel-${status ?? "osszes"}-${date}`;
  // Excel formátum
  if (url.searchParams.get("format") === "xlsx") {
    return new Response(new Uint8Array(subscribersXlsx(status)), {
      headers: {
        "Content-Type": XLSX_TYPE,
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return new Response(subscribersCsv(status), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
