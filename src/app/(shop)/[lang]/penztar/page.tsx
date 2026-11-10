import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CheckoutForm from "@/components/cupre/checkout-form";
import { getDictionary } from "@/services/dictionary-service";
import { getCompanyInfo } from "@/services/company-service";
import { paymentOptions } from "@/services/payment-service";
import { shippingOptions } from "@/services/shipping-service";
import { hasLocale } from "@/lib/i18n";

// Nyelvfüggő oldalcím; a pénztár nem kerül a keresőkbe
export async function generateMetadata({ params }: PageProps<"/[lang]/penztar">): Promise<Metadata> {
  const { lang } = await params;
  // Ismeretlen nyelvnél a layout 404-et ad
  if (!hasLocale(lang)) {
    return {};
  }
  const dict = getDictionary(lang);
  return { title: dict.meta.checkoutTitle, description: dict.meta.checkoutDescription, robots: { index: false } };
}

// Pénztár oldal: a kosár tartalma a böngészőben van, ezért maga az űrlap kliens komponens
export default async function CheckoutPage({ params }: PageProps<"/[lang]/penztar">) {
  const { lang } = await params;
  // Nem támogatott nyelvre 404
  if (!hasLocale(lang)) {
    notFound();
  }
  const dict = getDictionary(lang);
  const company = getCompanyInfo();
  return (
    <main>
      <section className="checkout-section">
        <div className="wrap">
          <div className="section-title">
            <div className="eyebrow">{dict.checkout.eyebrow}</div>
            <h1>{dict.checkout.title}</h1>
          </div>
          <CheckoutForm
            settings={{
              liveOrders: company.shop.liveOrders,
              shippingOptions: shippingOptions(),
              paymentOptions: paymentOptions(),
            }}
          />
        </div>
      </section>
    </main>
  );
}
