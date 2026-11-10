import { LegalDocumentRoute, legalDocumentMetadata } from "@/components/cupre/legal-route";

// Nyelvfüggő oldalcím és hreflang alternatívák
export async function generateMetadata({ params }: PageProps<"/[lang]/adatvedelem">) {
  return legalDocumentMetadata(params, "adatvedelem");
}

// Adatkezelési tájékoztató (src/data/legal/<nyelv>.json, a cégadatok a company.json-ból)
export default function Page({ params }: PageProps<"/[lang]/adatvedelem">) {
  return <LegalDocumentRoute params={params} documentKey="adatvedelem" />;
}
