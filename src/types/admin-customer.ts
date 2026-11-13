import type { NewsletterStatus } from "@/types/account";
import type { OrderStatus } from "@/types/admin-order";

// Vásárló az admin listában (rendelési összesítővel)
export type AdminCustomerListItem = {
  id: number;
  name: string;
  email: string;
  phone: string;
  city: string;
  createdAt: string;
  // Regisztrált fiók azonosítója (null: vendég)
  accountId: number | null;
  // Letiltott fiók időpontja (null: nincs letiltva)
  disabledAt: string | null;
  // Anonimizált (GDPR törlés után) ügyfél
  anonymized: boolean;
  orderCount: number;
  // A nem lemondott rendelések összértéke
  totalSpentHuf: number;
  lastOrderAt: string | null;
  newsletter: NewsletterStatus | null;
};

// Vásárló részletei: elérhetőség, fiók, rendelések
export type AdminCustomerDetail = AdminCustomerListItem & {
  postcode: string;
  address: string;
  lastLoginAt: string | null;
  orders: { id: number; createdAt: string; status: OrderStatus; totalHuf: number; invoiceNumber: string | null }[];
};
