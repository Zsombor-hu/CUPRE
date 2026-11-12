import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary } from "@/lib/i18n";

// Márkatörténet panel sötétzöld háttéren a holdsarló logóval
export default function BrandStory({ dict }: { dict: Dictionary }) {
  return (
    <section className="brand-section" id="marka">
      <div className="wrap brand-panel">
        <Image alt="" src={IMAGES.logo} width={160} height={150} unoptimized />
        <div className="eyebrow light">{dict.brand.eyebrow}</div>
        <h2>
          {dict.brand.title[0]}
          <br />
          {dict.brand.title[1]}
        </h2>
        <p>{dict.brand.text}</p>
      </div>
    </section>
  );
}
