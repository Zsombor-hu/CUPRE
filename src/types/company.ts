// A szolgáltató (webáruház üzemeltetője) adatai – impresszum, ÁSZF, adatkezelési tájékoztató
export type CompanyDetails = {
  name: string;
  seat: string;
  postalAddress: string;
  email: string;
  phone: string;
  registryNumber: string;
  registryCourt: string;
  taxNumber: string;
  euVatNumber: string;
  representative: string;
};

// Név + cím + e-mail hármas (tárhelyszolgáltató)
export type ContactParty = {
  name: string;
  address: string;
  email: string;
};

// A company.json teljes szerkezete (környezetenként külön fájl)
export type CompanyInfo = {
  company: CompanyDetails;
  hosting: ContactParty;
  conciliationBody: ContactParty & { phone: string };
  dataProtectionAuthority: { name: string; address: string; website: string };
  shop: {
    // true esetén a rendelés éles: a gomb „Megrendelés fizetési kötelezettséggel” feliratú
    liveOrders: boolean;
    // Szállítási módok, egyenként be/kikapcsolhatóan, módonként fix díjjal
    shipping: ShippingSettings;
    // A jogi dokumentumok hatálybalépésének dátuma
    legalUpdated: string;
    // Fizetési módok, egyenként be/kikapcsolhatóan
    payments: PaymentSettings;
  };
};

// Egy szállítási mód beállítása: kapcsoló, fix díj (forint), várható szállítási idő (munkanap, szövegként)
export type ShippingModeSettings = {
  enabled: boolean;
  feeHuf: number;
  deliveryDays: string;
};

// Szállítási módok (company.json → shop.shipping)
export type ShippingSettings = {
  // Házhozszállítás futárral; a futárcég neve beállítható
  home: ShippingModeSettings & { carrierName: string };
  // Foxpost csomagautomata (térképes automatakereső)
  foxpost: ShippingModeSettings;
  // MPL PostaPont / posta / MPL csomagautomata
  mplPoint: ShippingModeSettings;
};

// Kártyás fizetés szolgáltatója: a „mock” csak fejlesztéshez (production környezetben tiltott)
export type CardProvider = "mock" | "barion";

// Fizetési módok beállításai (company.json → shop.payments)
export type PaymentSettings = {
  card: { enabled: boolean; provider: CardProvider };
  transfer: {
    enabled: boolean;
    accountHolder: string;
    bankName: string;
    accountNumber: string;
    iban: string;
    swift: string;
    // Fizetési határidő napokban
    dueDays: number;
  };
  // Utánvét, opcionális díjjal (forint)
  cod: { enabled: boolean; feeHuf: number };
};
