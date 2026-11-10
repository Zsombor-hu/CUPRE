import "server-only";
import hu from "@/data/i18n/hu.json";
import en from "@/data/i18n/en.json";
import de from "@/data/i18n/de.json";
import type { Dictionary, Locale } from "@/lib/i18n";

// A felületi szövegek szótárai (src/data/i18n); környezetfüggetlenek, ezért nincsenek környezetenként duplikálva.
// A `satisfies` miatt a build hibát ad, ha az angol vagy német szótárból hiányzik egy kulcs.
const DICTIONARIES = {
  hu,
  en: en satisfies Dictionary,
  de: de satisfies Dictionary,
} as const;

// Az adott nyelv szótára
export function getDictionary(lang: Locale): Dictionary {
  return DICTIONARIES[lang];
}
