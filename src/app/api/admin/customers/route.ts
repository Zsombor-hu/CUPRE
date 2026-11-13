import { anonymizeCustomer, getCustomerDetail, listCustomers, setCustomerDisabled } from "@/services/customer-admin-service";
import { logAdminAction } from "@/services/audit-service";
import { idParam, noStoreJson, requireAdminName } from "@/services/admin-guard";
import { formError, okResponse, readJson } from "@/services/api-helpers";
import { record } from "@/lib/validation";

// Admin: vásárlók listája (?q=… kereséssel) vagy egy vásárló részletei (?id=…)
export async function GET(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const url = new URL(request.url);
  // Egy vásárló részletei
  if (url.searchParams.has("id")) {
    const detail = getCustomerDetail(idParam(request));
    return detail ? noStoreJson({ customer: detail }) : formError("invalidRequest", 404);
  }
  return noStoreJson({ customers: listCustomers(url.searchParams.get("q")) });
}

// Admin: vásárló fiókjának letiltása / engedélyezése ({ action: "disable" | "enable" }) vagy anonimizálása ({ action: "anonymize" })
export async function PATCH(request: Request) {
  const admin = await requireAdminName();
  // Nincs jogosultság
  if ("denied" in admin) {
    return admin.denied;
  }
  const id = idParam(request);
  const action = record(await readJson(request)).action;
  // Fiók letiltása vagy engedélyezése
  if (action === "disable" || action === "enable") {
    // Vendég vásárlónak nincs fiókja
    if (!setCustomerDisabled(id, action === "disable")) {
      return formError("invalidRequest", 409);
    }
    logAdminAction(admin.name, action === "disable" ? "customer.disable" : "customer.enable", "customer", id);
    return okResponse();
  }
  // GDPR törlés: a naplóba személyes adat nem kerül, csak az azonosító
  if (action === "anonymize") {
    // Ismeretlen vásárló
    if (!anonymizeCustomer(id)) {
      return formError("invalidRequest", 404);
    }
    logAdminAction(admin.name, "customer.anonymize", "customer", id);
    return okResponse();
  }
  return formError("invalidRequest");
}
