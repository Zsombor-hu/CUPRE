import "server-only";
import type { FaqItem, FaqItemData } from "@/types/faq";
import { LOCALES, isLocalizedText as isLocalized, localePath, type Locale } from "@/lib/i18n";
import { readJsonData } from "@/services/data-paths";

// Egy GYIK rekord szerkezeti ellenőrzése
function isFaqItem(value: unknown): value is FaqItemData {
  const item = value as FaqItemData;
  return (
    typeof item === "object" &&
    item !== null &&
    typeof item.id === "string" &&
    isLocalized(item.question) &&
    isLocalized(item.answer) &&
    (item.link === undefined || (typeof item.link.href === "string" && isLocalized(item.link.label)))
  );
}

// GYIK elemek a környezet faq.json fájljából a megadott nyelven; hibás szerkezet vagy ismétlődés esetén hibát dob
export function getFaqItems(lang: Locale): FaqItem[] {
  const data = readJsonData("faq.json");
  // A fájlnak tömbnek kell lennie, minden eleme érvényes, minden nyelven kitöltött GYIK rekord
  if (!Array.isArray(data) || !data.every(isFaqItem)) {
    throw new Error("A faq.json szerkezete hibás (vagy hiányzik egy fordítás).");
  }
  const seen = new Set<string>();
  // Duplikált azonosító vagy (bármely nyelvű) kérdés nem kerülhet ki az oldalra
  for (const item of data) {
    const keys = [`id:${item.id}`, ...LOCALES.map((code) => `${code}:${item.question[code].trim().toLowerCase()}`)];
    // Ismétlődés esetén hibát dobunk, hogy az adathiba még build közben kiderüljön
    if (keys.some((key) => seen.has(key))) {
      throw new Error(`Duplikált GYIK elem a faq.json-ban: ${item.question.hu}`);
    }
    keys.forEach((key) => seen.add(key));
  }
  return data.map((item) => ({
    id: item.id,
    question: item.question[lang],
    answer: item.answer[lang],
    link: item.link ? { href: localePath(lang, item.link.href), label: item.link.label[lang] } : undefined,
  }));
}
