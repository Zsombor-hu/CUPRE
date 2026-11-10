import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary } from "@/lib/i18n";

// Ünnepi ajándékbanner a kiemelt termék alatt; a felirat a képbe van égetve (magyarul), ezért csak az alt szöveg fordított
export default function GiftBanner({ dict }: { dict: Dictionary }) {
  return (
    <section className="gift-feature-section">
      <div className="wrap">
        <aside className="gift-card" id="ajandek">
          <Image
            alt={dict.gift.alt}
            src={IMAGES.giftBanner}
            width={1420}
            height={206}
            quality={90}
            sizes="(max-width: 1450px) 100vw, 1370px"
          />
        </aside>
      </div>
    </section>
  );
}
