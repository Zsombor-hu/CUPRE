import type { LocalizedText } from "@/lib/i18n";

// GYIK elem a faq.json-ban: háromnyelvű kérdés és válasz, opcionális hivatkozással
export type FaqItemData = {
  id: string;
  question: LocalizedText;
  answer: LocalizedText;
  link?: {
    href: string;
    label: LocalizedText;
  };
};

// Egy nyelvre feloldott GYIK elem (a link útvonala már nyelvi előtaggal)
export type FaqItem = {
  id: string;
  question: string;
  answer: string;
  link?: {
    href: string;
    label: string;
  };
};
