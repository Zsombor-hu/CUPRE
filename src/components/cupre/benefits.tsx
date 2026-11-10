import type { Dictionary } from "@/lib/i18n";

// Az öt érték ikonja, a szótár benefits.items sorrendjében
const ICONS = [
  <svg key="rest" viewBox="0 0 48 48">
    <rect height="18" rx="3" width="36" x="6" y="20"></rect>
    <path d="M9 20v-7h30v7M13 20v-5h10v5M26 20v-5h10v5M8 38v4m32-4v4"></path>
  </svg>,
  <svg key="materials" viewBox="0 0 48 48">
    <path d="M24 4 40 11v13c0 11-8 16-16 20C16 40 8 35 8 24V11Z"></path>
    <path d="M24 14v19M15 23h18"></path>
  </svg>,
  <svg key="copper" viewBox="0 0 48 48">
    <path d="M6 17q18-18 36 0M12 24q12-12 24 0M18 31q6-6 12 0"></path>
    <circle cx="24" cy="39" r="2"></circle>
  </svg>,
  <svg key="design" viewBox="0 0 48 48">
    <path d="M8 39C8 16 25 8 42 7c-1 20-9 33-34 32ZM8 39c8-11 18-19 30-27"></path>
  </svg>,
  <svg key="gift" viewBox="0 0 48 48">
    <rect height="23" rx="2" width="36" x="6" y="20"></rect>
    <path d="M24 20v23M6 28h36M24 20c-18 0-19-14-9-14 6 0 9 14 9 14Zm0 0c18 0 19-14 9-14-6 0-9 14-9 14Z"></path>
  </svg>,
];

// Értékek sáv a hero alatt: öt ikon kétsoros felirattal
export default function Benefits({ dict }: { dict: Dictionary }) {
  return (
    <section aria-label={dict.benefits.aria} className="benefits">
      <div className="wrap benefits-grid">
        {dict.benefits.items.map(([first, second], index) => (
          <div className="benefit" key={ICONS[index].key}>
            {ICONS[index]}
            <span>
              {first}
              <br />
              {second}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
