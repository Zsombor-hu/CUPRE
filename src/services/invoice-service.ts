import "server-only";
import fs from "node:fs";
import path from "node:path";
import { getAppEnv } from "@/lib/app-env";
import { getCompanyInfo } from "@/services/company-service";
import { getCustomerDb } from "@/services/customer-db";
import { dataDir } from "@/services/data-paths";
import { text } from "@/lib/validation";

// Számlázz.hu Számla Agent végpont (XML fájl feltöltése multipart űrlapként)
const AGENT_URL = "https://www.szamlazz.hu/szamla/";

// Hibakódok (az admin szótár orders.invoice.errors kulcsai)
export type InvoiceError = "notFound" | "alreadyIssued" | "notConfigured" | "canceled" | "providerError" | "invalidNumber";

// A számlázás beállításai a környezeti változókból
type InvoiceConfig = {
  // Számla Agent kulcs; „mock”: fejlesztői teszt-számlázó (production környezetben tiltott)
  agentKey: string;
  // ÁFA-kulcs a Számlázz.hu jelölésével: „27”, „18”, „5”, „0” vagy pl. „AAM” (alanyi adómentes)
  vatRate: string;
  // Számlaszám-előtag (opcionális, a Számlázz.hu fiókban előre felvett előtag)
  prefix: string;
  // A Számlázz.hu küldje-e e-mailben a számlát a vásárlónak
  sendEmail: boolean;
};

// Számlázási beállítások; ha nincs kulcs (vagy élesben „mock”), null
export function invoiceConfig(): InvoiceConfig | null {
  const agentKey = (process.env.SZAMLAZZ_AGENT_KEY ?? "").trim();
  // Kulcs nélkül csak a számlaszám kézi rögzítése érhető el
  if (!agentKey || (agentKey === "mock" && getAppEnv() === "production")) {
    return null;
  }
  return {
    agentKey,
    vatRate: (process.env.SZAMLAZZ_VAT_RATE ?? "27").trim() || "27",
    prefix: (process.env.SZAMLAZZ_PREFIX ?? "").trim(),
    sendEmail: process.env.SZAMLAZZ_SEND_EMAIL !== "false",
  };
}

// A kiállított számlák PDF-jeinek könyvtára (src/data/<környezet>/invoices)
function invoiceDir(): string {
  return path.join(dataDir(), "invoices");
}

// XML szöveg escape-elése
function xml(value: string | number): string {
  return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Dátum ÉÉÉÉ-HH-NN formában budapesti idő szerint (opcionális napeltolással)
function budapestDate(offsetDays = 0): string {
  const date = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Budapest" }).format(date);
}

// Számlatétel bruttó összegből: nettó és ÁFA kiszámítása a beállított kulcs szerint (egész forintra kerekítve)
type InvoiceLine = { name: string; qty: number; unit: string; grossTotal: number; comment: string };

// Egy tétel XML-je
function lineXml(line: InvoiceLine, vatRate: string): string {
  const percent = Number(vatRate);
  const rate = Number.isFinite(percent) ? percent / 100 : 0;
  const net = Math.round(line.grossTotal / (1 + rate));
  const vat = line.grossTotal - net;
  const unitNet = Math.round((net / line.qty) * 100) / 100;
  return `    <tetel>
      <megnevezes>${xml(line.name)}</megnevezes>
      <mennyiseg>${line.qty}</mennyiseg>
      <mennyisegiEgyseg>${xml(line.unit)}</mennyisegiEgyseg>
      <nettoEgysegar>${unitNet}</nettoEgysegar>
      <afakulcs>${xml(vatRate)}</afakulcs>
      <nettoErtek>${net}</nettoErtek>
      <afaErtek>${vat}</afaErtek>
      <bruttoErtek>${line.grossTotal}</bruttoErtek>
      <megjegyzes>${xml(line.comment)}</megjegyzes>
    </tetel>`;
}

// A számlához szükséges rendelésadatok
type InvoiceOrder = {
  id: number;
  status: string;
  lang: string;
  name: string;
  email: string;
  postcode: string;
  city: string;
  address: string;
  paymentMethod: string;
  paymentStatus: string;
  shippingMethod: string;
  shippingFeeHuf: number;
  paymentFeeHuf: number;
  discountHuf: number;
  couponCode: string | null;
  invoiceNumber: string | null;
};

// Rendelés beolvasása a számlához
function readOrder(id: number): InvoiceOrder | null {
  const row = getCustomerDb()
    .prepare(
      `SELECT o.id, o.status, o.lang, COALESCE(NULLIF(o.ship_name, ''), c.name) AS name, c.email,
         COALESCE(NULLIF(o.ship_postcode, ''), c.postcode) AS postcode, COALESCE(NULLIF(o.ship_city, ''), c.city) AS city,
         COALESCE(NULLIF(o.ship_address, ''), c.address) AS address, o.payment_method AS paymentMethod,
         o.payment_status AS paymentStatus, o.shipping_method AS shippingMethod, o.shipping_fee_huf AS shippingFeeHuf,
         o.payment_fee_huf AS paymentFeeHuf, o.discount_huf AS discountHuf, o.coupon_code AS couponCode,
         o.invoice_number AS invoiceNumber
       FROM orders o JOIN customers c ON c.id = o.customer_id WHERE o.id = ?`,
    )
    .get(id) as InvoiceOrder | undefined;
  return row ?? null;
}

// Fizetési mód a Számlázz.hu számára (szövegesen, a számla nyelvén jelenik meg)
const PAYMENT_LABELS: Record<string, string> = {
  card: "Bankkártya",
  transfer: "Átutalás",
  cod: "Utánvét",
  none: "Egyéb",
};

// Szállítási mód tételneve
const SHIPPING_LABELS: Record<string, string> = {
  home: "Házhozszállítás",
  foxpost: "Foxpost csomagautomata",
  mpl_point: "MPL PostaPont",
};

// A Számla Agent XML kérése a rendelésből
function buildInvoiceXml(order: InvoiceOrder, config: InvoiceConfig): string {
  const items = getCustomerDb()
    .prepare("SELECT sku, product_name AS productName, size, grade, qty, unit_price_huf AS unitPriceHuf FROM order_items WHERE order_id = ?")
    .all(order.id) as { sku: string; productName: string; size: string; grade: string; qty: number; unitPriceHuf: number }[];
  const lines: InvoiceLine[] = items.map((item) => ({
    name: `${item.productName} ${item.size} (${item.grade === "first" ? "I. o." : "II. o."})`,
    qty: Number(item.qty),
    unit: "db",
    grossTotal: Number(item.qty) * Number(item.unitPriceHuf),
    comment: item.sku,
  }));
  // Kuponkedvezmény negatív tételként
  if (order.discountHuf > 0) {
    lines.push({ name: `Kedvezmény (${order.couponCode ?? ""})`, qty: 1, unit: "db", grossTotal: -order.discountHuf, comment: "" });
  }
  // Szállítási díj
  if (order.shippingFeeHuf > 0) {
    lines.push({ name: SHIPPING_LABELS[order.shippingMethod] ?? "Szállítás", qty: 1, unit: "db", grossTotal: order.shippingFeeHuf, comment: "" });
  }
  // Utánvételi díj
  if (order.paymentFeeHuf > 0) {
    lines.push({ name: "Utánvételi díj", qty: 1, unit: "db", grossTotal: order.paymentFeeHuf, comment: "" });
  }
  const paid = order.paymentStatus === "paid";
  const dueDays = order.paymentMethod === "transfer" && !paid ? getCompanyInfo().shop.payments.transfer.dueDays : 0;
  const lang = ["hu", "en", "de"].includes(order.lang) ? order.lang : "hu";
  return `<?xml version="1.0" encoding="UTF-8"?>
<xmlszamla xmlns="http://www.szamlazz.hu/xmlszamla" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.szamlazz.hu/xmlszamla https://www.szamlazz.hu/szamla/docs/xsds/agent/xmlszamla.xsd">
  <beallitasok>
    <szamlaagentkulcs>${xml(config.agentKey)}</szamlaagentkulcs>
    <eszamla>true</eszamla>
    <szamlaLetoltes>true</szamlaLetoltes>
    <valaszVerzio>1</valaszVerzio>
  </beallitasok>
  <fejlec>
    <keltDatum>${budapestDate()}</keltDatum>
    <teljesitesDatum>${budapestDate()}</teljesitesDatum>
    <fizetesiHataridoDatum>${budapestDate(dueDays)}</fizetesiHataridoDatum>
    <fizmod>${xml(PAYMENT_LABELS[order.paymentMethod] ?? "Egyéb")}</fizmod>
    <penznem>HUF</penznem>
    <szamlaNyelve>${lang}</szamlaNyelve>
    <megjegyzes>${xml(`Rendelésszám: #${order.id}`)}</megjegyzes>
    <rendelesSzam>${order.id}</rendelesSzam>
${config.prefix ? `    <szamlaszamElotag>${xml(config.prefix)}</szamlaszamElotag>\n` : ""}    <fizetve>${paid ? "true" : "false"}</fizetve>
  </fejlec>
  <elado></elado>
  <vevo>
    <nev>${xml(order.name)}</nev>
    <irsz>${xml(order.postcode)}</irsz>
    <telepules>${xml(order.city)}</telepules>
    <cim>${xml(order.address)}</cim>
    <email>${xml(order.email)}</email>
    <sendEmail>${config.sendEmail ? "true" : "false"}</sendEmail>
  </vevo>
  <tetelek>
${lines.map((line) => lineXml(line, config.vatRate)).join("\n")}
  </tetelek>
</xmlszamla>`;
}

// Fájlnévben biztonságos számlaszám
function safeFileName(invoiceNumber: string): string {
  return `${invoiceNumber.replace(/[^A-Za-z0-9_-]/g, "_")}.pdf`;
}

// A kiállított számla mentése a rendeléshez (szám, időpont, opcionális PDF)
function saveInvoice(orderId: number, invoiceNumber: string, pdf: Buffer | null): void {
  let fileName: string | null = null;
  // A PDF a környezet invoices könyvtárába kerül
  if (pdf && pdf.length > 0) {
    fs.mkdirSync(invoiceDir(), { recursive: true });
    fileName = safeFileName(invoiceNumber);
    fs.writeFileSync(path.join(invoiceDir(), fileName), pdf);
  }
  getCustomerDb()
    .prepare("UPDATE orders SET invoice_number = ?, invoice_issued_at = datetime('now'), invoice_file = ? WHERE id = ?")
    .run(invoiceNumber, fileName, orderId);
}

// Számla kiállítása a Számlázz.hu Számla Agenttel (mock kulcsnál fejlesztői teszt-számlaszám PDF nélkül)
export async function issueInvoice(orderId: number): Promise<{ ok: true; invoiceNumber: string } | { ok: false; error: InvoiceError; message?: string }> {
  const config = invoiceConfig();
  // Nincs beállított számlázó
  if (!config) {
    return { ok: false, error: "notConfigured" };
  }
  const order = readOrder(orderId);
  // Ismeretlen rendelés
  if (!order) {
    return { ok: false, error: "notFound" };
  }
  // Egy rendeléshez egy számla
  if (order.invoiceNumber) {
    return { ok: false, error: "alreadyIssued" };
  }
  // Lemondott rendelésről nem állítunk ki számlát
  if (order.status === "canceled") {
    return { ok: false, error: "canceled" };
  }
  // Fejlesztői teszt-számlázó
  if (config.agentKey === "mock") {
    const invoiceNumber = `TESZT-${new Date().getFullYear()}-${String(orderId).padStart(5, "0")}`;
    saveInvoice(orderId, invoiceNumber, null);
    return { ok: true, invoiceNumber };
  }
  const form = new FormData();
  form.append("action-xmlagentxmlfile", new Blob([buildInvoiceXml(order, config)], { type: "text/xml" }), "szamla.xml");
  let response: Response;
  // Hálózati hiba esetén a rendelés változatlan marad, újrapróbálható
  try {
    response = await fetch(AGENT_URL, { method: "POST", body: form, signal: AbortSignal.timeout(30_000) });
  } catch (error) {
    console.error(`A(z) #${orderId} rendelés számlája nem készült el (hálózat):`, error);
    return { ok: false, error: "providerError", message: (error as Error).message };
  }
  const errorCode = response.headers.get("szlahu_error_code");
  const invoiceNumber = response.headers.get("szlahu_szamlaszam");
  // A Számlázz.hu hibát jelzett (a hibaüzenet URL-kódolva érkezik)
  if (errorCode || !invoiceNumber || !response.ok) {
    const message = decodeURIComponent(response.headers.get("szlahu_error") ?? "").replace(/\+/g, " ") || `HTTP ${response.status}`;
    console.error(`A(z) #${orderId} rendelés számlája nem készült el: ${errorCode ?? ""} ${message}`);
    return { ok: false, error: "providerError", message: text(message, 300) };
  }
  const body = Buffer.from(await response.arrayBuffer());
  const isPdf = body.subarray(0, 4).toString("latin1") === "%PDF";
  saveInvoice(orderId, invoiceNumber, isPdf ? body : null);
  return { ok: true, invoiceNumber };
}

// Máshol (pl. kézzel, a számlázó felületén) kiállított számla számának rögzítése vagy törlése (üres szám)
export function setInvoiceNumber(orderId: number, value: unknown): { ok: true; invoiceNumber: string | null } | { ok: false; error: InvoiceError } {
  const invoiceNumber = text(value, 60);
  // Csak betű, szám, kötőjel, perjel, pont és alulvonás
  if (invoiceNumber && !/^[A-Za-z0-9\-/._ ]+$/.test(invoiceNumber)) {
    return { ok: false, error: "invalidNumber" };
  }
  const result = getCustomerDb()
    .prepare(
      `UPDATE orders SET invoice_number = ?, invoice_issued_at = CASE WHEN ? IS NULL THEN NULL ELSE datetime('now') END,
         invoice_file = NULL WHERE id = ?`,
    )
    .run(invoiceNumber || null, invoiceNumber || null, orderId);
  // Ismeretlen rendelés
  if (Number(result.changes) === 0) {
    return { ok: false, error: "notFound" };
  }
  return { ok: true, invoiceNumber: invoiceNumber || null };
}

// A rendelés számlájának PDF-je (ha a Számlázz.hu visszaküldte); egyébként null
export function readInvoicePdf(orderId: number): { fileName: string; data: Buffer } | null {
  const row = getCustomerDb().prepare("SELECT invoice_file AS file FROM orders WHERE id = ?").get(orderId) as { file: string | null } | undefined;
  // Nincs mentett PDF
  if (!row?.file) {
    return null;
  }
  const filePath = path.join(invoiceDir(), path.basename(row.file));
  // A fájl időközben törlődhetett
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return { fileName: path.basename(row.file), data: fs.readFileSync(filePath) };
}
