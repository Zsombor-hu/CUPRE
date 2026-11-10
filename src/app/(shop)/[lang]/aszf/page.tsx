import { LegalDocumentRoute, legalDocumentMetadata } from "@/components/cupre/legal-route";

// Nyelvfüggő oldalcím és hreflang alternatívák
export async function generateMetadata({ params }: PageProps<"/[lang]/aszf">) {
  return legalDocumentMetadata(params, "aszf");
}

// Általános Szerződési Feltételek (src/data/legal/<nyelv>.json, a cégadatok a company.json-ból)
export default function Page({ params }: PageProps<"/[lang]/aszf">) {
  return <LegalDocumentRoute params={params} documentKey="aszf" />;
}
