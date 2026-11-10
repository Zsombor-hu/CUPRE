import type { Dictionary } from "@/lib/i18n";

// Fiók/hírlevél API hibakód → megjelenített szöveg a szótárból (ismeretlen kódra általános hibaüzenet)
export function accountError(dict: Dictionary, code: string | undefined): string | null {
  // Nincs hiba ennél a mezőnél
  if (!code) {
    return null;
  }
  const messages = dict.account.errors as Record<string, string>;
  return messages[code] ?? dict.account.errors.invalidRequest;
}
