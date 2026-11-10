// Fiók- és hírlevél-oldalak közös kerete a CUPRÉ stílusában: felirat, cím, bevezető és a tartalom egy kártyán
export default function AccountShell({
  eyebrow,
  title,
  intro,
  wide = false,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <main>
      <section className="checkout-section account-section">
        <div className="wrap">
          <div className={wide ? "account-card wide" : "account-card"}>
            <div className="eyebrow">{eyebrow}</div>
            <h1>{title}</h1>
            {intro ? <p className="account-intro">{intro}</p> : null}
            {children}
          </div>
        </div>
      </section>
    </main>
  );
}
