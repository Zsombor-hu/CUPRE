// A jogi aloldalak azonosítói (egyben az URL-szegmensek: /aszf, /adatvedelem, /elallas, /impresszum)
export type LegalPageKey = "aszf" | "adatvedelem" | "elallas" | "impresszum";

// Szövegdokumentumként tárolt jogi oldalak (az impresszum a company.json-ból épül)
export type LegalDocumentKey = Exclude<LegalPageKey, "impresszum">;

// Egy fejezet: cím és bekezdések
export type LegalSection = {
  heading: string;
  paragraphs: string[];
};

// Jogi dokumentum egy nyelven; az elállási tájékoztatóhoz nyilatkozatminta is tartozik
export type LegalDocument = {
  title: string;
  intro: string;
  sections: LegalSection[];
  form?: {
    title: string;
    note: string;
    lines: string[];
  };
};
