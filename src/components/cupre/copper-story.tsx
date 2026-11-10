import Image from "next/image";
import { IMAGES } from "@/lib/cupre-content";
import type { Dictionary } from "@/lib/i18n";

const CARD_SIZES = "(max-width: 520px) 100vw, (max-width: 850px) 50vw, 33vw";

// A három kártya képe és osztálya, a szótár story.cards sorrendjében
const CARD_IMAGES = [
  { src: IMAGES.storyTexture, width: 1536, height: 1024, className: "story-card" },
  { src: IMAGES.storyHome, width: 1346, height: 761, className: "story-card" },
  { src: IMAGES.storyProtection, width: 1000, height: 465, className: "story-card protection-card" },
];

// „A réz különleges világa” szekció három kártyával
export default function CopperStory({ dict }: { dict: Dictionary }) {
  return (
    <section className="copper-story" id="rez">
      <div className="wrap story-heading">
        <span className="line"></span>
        <div>
          <div className="eyebrow">{dict.story.eyebrow}</div>
          <h2>{dict.story.title}</h2>
          <p>{dict.story.text}</p>
        </div>
        <span className="line"></span>
      </div>
      <div className="wrap story-cards">
        {dict.story.cards.map((card, index) => (
          <div className={CARD_IMAGES[index].className} key={CARD_IMAGES[index].src}>
            <Image
              alt={card.alt}
              src={CARD_IMAGES[index].src}
              width={CARD_IMAGES[index].width}
              height={CARD_IMAGES[index].height}
              quality={90}
              sizes={CARD_SIZES}
            />
            <h3>{card.title}</h3>
            <p>{card.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
