import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary } from "@/lib/i18n";

// Csomagolás bemutató szekció
export default function Packaging({ dict }: { dict: Dictionary }) {
  return (
    <section className="packaging" id="csomagolas">
      <div className="wrap package-inner">
        <div>
          <div className="eyebrow">{dict.packaging.eyebrow}</div>
          <h2>{dict.packaging.title}</h2>
          <p>{dict.packaging.text}</p>
          <p className="muted">{dict.packaging.muted}</p>
        </div>
        {/* A CSS itt nem ad magasságot, ezért height:auto kell, különben a height attribútum torzítaná a képet */}
        <Image
          alt={dict.packaging.alt}
          src={IMAGES.packaging}
          width={576}
          height={317}
          quality={90}
          sizes="(max-width: 850px) 100vw, 50vw"
          style={{ height: "auto" }}
        />
      </div>
    </section>
  );
}
