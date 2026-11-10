import { isAdmin } from "@/services/auth-service";
import { subscribersCsv } from "@/services/newsletter-service";
import { formError } from "@/services/api-helpers";
import type { NewsletterStatus } from "@/types/account";

// Admin: feliratkozók CSV-ben (alapértelmezésben csak az aktívak – ezeknek szabad hírlevelet küldeni)
export async function GET(request: Request) {
  // Admin munkamenet nélkül nincs hozzáférés
  if (!(await isAdmin())) {
    return formError("unauthorized", 401);
  }
  const param = new URL(request.url).searchParams.get("status") ?? "active";
  const status: NewsletterStatus | undefined =
    param === "pending" || param === "active" || param === "unsubscribed" ? param : undefined;
  const date = new Date().toISOString().slice(0, 10);
  return new Response(subscribersCsv(status), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="cupre-hirlevel-${status ?? "osszes"}-${date}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
