import { readInvoicePdf } from "@/services/invoice-service";
import { idParam, requireAdminName } from "@/services/admin-guard";
import { formError } from "@/services/api-helpers";

// Admin: a rendelés számlájának PDF-je (?id=…), ha a Számlázz.hu visszaküldte
export async function GET(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const pdf = readInvoicePdf(idParam(request));
  // Nincs mentett számla-PDF
  if (!pdf) {
    return formError("invalidRequest", 404);
  }
  return new Response(new Uint8Array(pdf.data), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${pdf.fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
