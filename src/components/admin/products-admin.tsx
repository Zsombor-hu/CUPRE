"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import { Button, Card } from "@heroui/react";
import AdminRedirect from "@/components/admin/admin-redirect";
import { useAdminI18n } from "@/components/admin/admin-i18n";
import { notify } from "@/components/admin/admin-feedback";
import { LOW_STOCK_THRESHOLD, type AdminProduct, type AdminVariant } from "@/types/product";

// Betöltési állapot
type State = { kind: "loading" } | { kind: "disabled" } | { kind: "login" } | { kind: "ready"; products: AdminProduct[] };

// Közös beviteli mező osztály
const INPUT = "w-full min-w-0 rounded-lg border border-foreground/20 bg-transparent px-2 py-1.5 tabular-nums";

// Módosítás küldése; a válasz: sikerült-e, és hiba esetén a hibakód
async function patch(query: string, body: Record<string, unknown>): Promise<{ ok: boolean; error: string }> {
  const response = await fetch(`/api/admin/products?${query}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as { error?: string };
  return { ok: response.ok, error: data.error ?? "" };
}

// Szövegmező értéke → egész szám vagy null (üres mező); érvénytelen szöveg esetén NaN
function parseOptionalInt(value: string): number | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : Number(trimmed);
}

// Egy változat szerkesztő sora: ár (üres: alapár), készlet (üres: nincs nyilvántartás), bekapcsolás, mentés
function VariantRow({ variant, onSaved }: { variant: AdminVariant; onSaved: () => Promise<void> }) {
  const { t, fmt, huf } = useAdminI18n();
  const p = t.products;
  const [price, setPrice] = useState(variant.priceOverrideHuf === null ? "" : String(variant.priceOverrideHuf));
  const [stock, setStock] = useState(variant.stock === null ? "" : String(variant.stock));
  const [busy, setBusy] = useState(false);
  const dirty = price !== (variant.priceOverrideHuf === null ? "" : String(variant.priceOverrideHuf)) || stock !== (variant.stock === null ? "" : String(variant.stock));

  // Mentés (a hibakódot az admin szótár fordítja)
  async function save(changes: Record<string, unknown>) {
    setBusy(true);
    const result = await patch(`sku=${encodeURIComponent(variant.sku)}`, changes);
    setBusy(false);
    // Hibás adat
    if (!result.ok) {
      const errors: Record<string, string> = p.errors;
      notify.error(errors[result.error] ?? t.common.genericError);
      return;
    }
    notify.success(fmt(p.saved, { sku: variant.sku }));
    await onSaved();
  }

  // Készlet növelése a megadott darabbal (áru beérkezése)
  function addStock(amount: number) {
    const current = parseOptionalInt(stock);
    setStock(String(Math.max(0, (current === null || Number.isNaN(current) ? 0 : current) + amount)));
  }

  const stockState =
    variant.stock === null ? p.untracked : variant.stock <= 0 ? p.soldOut : variant.stock <= LOW_STOCK_THRESHOLD ? p.low : p.inStock;
  const stockClass =
    variant.stock === null ? "text-foreground/50" : variant.stock <= 0 ? "text-danger" : variant.stock <= LOW_STOCK_THRESHOLD ? "text-warning" : "text-success";
  const grade = variant.grade === "first" ? t.orders.detail.firstGrade : t.orders.detail.secondGrade;
  return (
    <form
      className={`grid grid-cols-2 items-center gap-2 border-t border-foreground/10 py-3 text-sm md:grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:gap-3 ${variant.active ? "" : "opacity-60"}`}
      onSubmit={(event) => {
        event.preventDefault();
        void save({ priceHuf: parseOptionalInt(price), stock: parseOptionalInt(stock) });
      }}
    >
      <div className="col-span-2 min-w-0 md:col-span-1">
        <div className="font-medium">
          {variant.size} · {grade}
        </div>
        <div className="text-foreground/60">{variant.sku}</div>
      </div>
      <div className="text-foreground/60">
        <span className="md:hidden">{p.columns.basePrice}: </span>
        {huf(variant.basePriceHuf)}
      </div>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-foreground/60">{p.columns.price}</span>
        <input className={INPUT} inputMode="numeric" placeholder={p.pricePlaceholder} value={price} onChange={(event) => setPrice(event.target.value)} />
      </label>
      <label className="flex flex-col gap-1">
        <span className="flex justify-between gap-2 text-xs">
          <span className="text-foreground/60">{p.columns.stock}</span>
          <span className={`font-semibold ${stockClass}`}>{stockState}</span>
        </span>
        <span className="flex gap-1">
          <input className={INPUT} inputMode="numeric" placeholder={p.stockPlaceholder} value={stock} onChange={(event) => setStock(event.target.value)} />
          <Button size="sm" variant="tertiary" aria-label={fmt(p.addStock, { count: 1 })} onPress={() => addStock(1)}>
            +1
          </Button>
          <Button size="sm" variant="tertiary" aria-label={fmt(p.addStock, { count: 10 })} onPress={() => addStock(10)}>
            +10
          </Button>
        </span>
      </label>
      <div className="col-span-2 flex flex-wrap justify-end gap-2 md:col-span-1">
        <Button type="submit" size="sm" isDisabled={busy || !dirty}>
          {t.common.save}
        </Button>
        <Button size="sm" variant={variant.active ? "ghost" : "secondary"} isDisabled={busy} onPress={() => void save({ active: !variant.active })}>
          {variant.active ? p.disable : p.enable}
        </Button>
      </div>
    </form>
  );
}

// Termékek és készlet: termékenként bekapcsolás és kiemelés, változatonként ár, készlet és rendelhetőség
export default function ProductsAdmin() {
  const { t, fmt } = useAdminI18n();
  const p = t.products;
  const [state, setState] = useState<State>({ kind: "loading" });
  const [revision, setRevision] = useState(0);

  // Lista betöltése; 403: letiltott admin, 401: belépés szükséges
  const load = useCallback(async () => {
    const response = await fetch("/api/admin/products", { cache: "no-store" });
    // Letiltott admin
    if (response.status === 403) {
      setState({ kind: "disabled" });
      return;
    }
    // Belépés szükséges
    if (!response.ok) {
      setState({ kind: "login" });
      return;
    }
    setState({ kind: "ready", products: ((await response.json()) as { products: AdminProduct[] }).products });
    // A szerkesztő sorok a friss értékekkel induljanak újra
    setRevision((value) => value + 1);
  }, []);

  // Első betöltés
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a lista csak a kliensen, az admin süti alapján kérdezhető le
    void load();
  }, [load]);

  // Termékszintű módosítás (bekapcsolás, kiemelés)
  async function updateProduct(product: AdminProduct, changes: { active?: boolean; featured?: boolean }) {
    const result = await patch(`slug=${encodeURIComponent(product.slug)}`, changes);
    // Hibás adat
    if (!result.ok) {
      const errors: Record<string, string> = p.errors;
      notify.error(errors[result.error] ?? t.common.genericError);
      return;
    }
    notify.success(fmt(p.productSaved, { name: product.name }));
    await load();
  }

  // Betöltés közben
  if (state.kind === "loading") {
    return <p className="p-6">{t.common.loading}</p>;
  }
  // Letiltott admin
  if (state.kind === "disabled") {
    return <p className="p-6">{t.common.disabled}</p>;
  }
  // Belépés szükséges
  if (state.kind === "login") {
    return <AdminRedirect />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold">{p.title}</h1>
        <p className="max-w-3xl text-sm text-foreground/60">{p.description}</p>
        <p className="max-w-3xl text-sm text-foreground/60">{p.stockHint}</p>
      </div>
      {state.products.map((product) => (
        <Card key={product.slug} className={product.active ? "" : "opacity-75"}>
          <Card.Header className="flex flex-row flex-wrap items-center gap-3">
            <Image src={product.image} alt="" width={72} height={40} className="h-10 w-18 rounded-md object-cover" />
            <div className="min-w-0 flex-1">
              <Card.Title className="flex flex-wrap items-center gap-2">
                {product.name}
                {product.featured ? <span className="rounded-full bg-accent px-2 text-xs text-accent-foreground">{p.featured}</span> : null}
                {!product.active ? <span className="rounded-full bg-foreground/10 px-2 text-xs">{p.inactive}</span> : null}
              </Card.Title>
              <Card.Description>{product.slug}</Card.Description>
            </div>
            <div className="flex flex-wrap gap-2">
              {!product.featured ? (
                <Button size="sm" variant="secondary" onPress={() => void updateProduct(product, { featured: true })}>
                  {p.makeFeatured}
                </Button>
              ) : null}
              <Button size="sm" variant={product.active ? "ghost" : "primary"} onPress={() => void updateProduct(product, { active: !product.active })}>
                {product.active ? p.disableProduct : p.enableProduct}
              </Button>
            </div>
          </Card.Header>
          <Card.Content>
            <div className="hidden grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)_minmax(0,1.3fr)_auto] gap-3 pb-1 text-xs font-semibold text-foreground/60 md:grid">
              <span>{p.columns.variant}</span>
              <span>{p.columns.basePrice}</span>
              <span />
              <span />
              <span />
            </div>
            {product.variants.map((variant) => (
              <VariantRow key={`${variant.sku}-${revision}`} variant={variant} onSaved={load} />
            ))}
          </Card.Content>
        </Card>
      ))}
    </div>
  );
}
