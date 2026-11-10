"use client";

import { useShop } from "@/hooks/use-shop";

// Alul középen megjelenő értesítés; a szöveg eltűnés után is megmarad, így a kiúszó animáció nem ugrik
export default function Toast() {
  const { toastMessage, toastVisible } = useShop();
  return (
    <div aria-live="polite" className={toastVisible ? "toast show" : "toast"} id="toast" role="status">
      {toastMessage}
    </div>
  );
}
