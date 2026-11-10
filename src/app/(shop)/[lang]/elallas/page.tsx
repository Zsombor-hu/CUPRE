import { LegalDocumentRoute, legalDocumentMetadata } from "@/components/cupre/legal-route";

// Nyelvfüggő oldalcím és hreflang alternatívák
export async function generateMetadata({ params }: PageProps<"/[lang]/elallas">) {
  return legalDocumentMetadata(params, "elallas");
}

// Elállási tájékoztató és nyilatkozatminta (src/data/legal/<nyelv>.json, a cégadatok a company.json-ból)
export default function Page({ params }: PageProps<"/[lang]/elallas">) {
  return <LegalDocumentRoute params={params} documentKey="elallas" />;
}
