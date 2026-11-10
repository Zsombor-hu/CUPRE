"use client";

import { useCallback, useEffect, useState } from "react";
import type { AccountOverview } from "@/types/account";

// A fiók betöltési állapota: betöltés, vendég (nincs belépve) vagy belépett ügyfél adatokkal
export type AccountState =
  | { status: "loading" }
  | { status: "guest" }
  | { status: "user"; overview: AccountOverview };

// A belépett ügyfél adatainak lekérdezése a /api/account/me végpontról; a reload újratölti (pl. mentés után)
export function useAccount(): { state: AccountState; reload: () => Promise<void> } {
  const [state, setState] = useState<AccountState>({ status: "loading" });

  // Lekérdezés: 200 → belépett, egyéb (401, hálózati hiba) → vendég
  const reload = useCallback(async () => {
    // Hálózati hiba esetén vendégként kezeljük a látogatót
    try {
      const response = await fetch("/api/account/me", { cache: "no-store" });
      // Csak sikeres válasznál van belépett ügyfél
      if (!response.ok) {
        setState({ status: "guest" });
        return;
      }
      setState({ status: "user", overview: (await response.json()) as AccountOverview });
    } catch {
      setState({ status: "guest" });
    }
  }, []);

  // Első betöltés a csatoláskor
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a fiók állapota csak a kliensen, a süti alapján kérdezhető le
    void reload();
  }, [reload]);

  return { state, reload };
}

// JSON POST/PATCH kérés küldése; a válasz hibakódjait (errors) adja vissza, sikernél null-t
export async function sendJson(
  url: string,
  body: unknown,
  method: "POST" | "PATCH" = "POST",
): Promise<Record<string, string> | null> {
  // Hálózati hibát „network” űrlapszintű hibaként adunk vissza
  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    // Sikeres művelet
    if (response.ok) {
      return null;
    }
    const data = (await response.json().catch(() => null)) as { errors?: Record<string, string> } | null;
    return data?.errors ?? { form: "invalidRequest" };
  } catch {
    return { form: "network" };
  }
}
