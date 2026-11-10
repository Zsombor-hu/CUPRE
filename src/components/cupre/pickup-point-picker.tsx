"use client";

import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/hooks/use-i18n";
import type { PickupPoint, ShippingOption } from "@/types/order";

// A Foxpost automatakereső (iframe) címe és az üzenetek elfogadott forrása. A beágyazás módja a Foxpost
// automatakeresőt használó nyílt forrású webshop-integrációk alapján igazolva (iframe + postMessage, JSON szöveg).
const FOXPOST_FINDER_URL = "https://cdn.foxpost.hu/apt-finder/v1/app/";
const FOXPOST_ORIGINS = new Set(["https://cdn.foxpost.hu", "https://foxpost.hu"]);

// Az MPL hivatalos webhelye (a pontok kereséséhez a vásárló itt tájékozódhat)
const MPL_SITE_URL = "https://www.posta.hu";

// A Foxpost üzenetének releváns mezői
type FoxpostMessage = {
  place_id?: number | string;
  operator_id?: string;
  name?: string;
  address?: string;
  zip?: string;
  city?: string;
  street?: string;
};

// A Foxpost üzenet átalakítása átvételi ponttá (hiányos üzenetnél null)
function parseFoxpostMessage(data: unknown): PickupPoint | null {
  let payload: unknown = data;
  // Az automatakereső JSON szövegként küldi az adatot
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  const apt = payload as FoxpostMessage;
  // Név nélküli vagy nem objektum üzenet nem választás
  if (typeof apt !== "object" || apt === null || typeof apt.name !== "string") {
    return null;
  }
  const address = apt.zip && apt.city && apt.street ? `${apt.zip} ${apt.city}, ${apt.street}` : (apt.address ?? "");
  const id = apt.operator_id ?? (apt.place_id !== undefined ? String(apt.place_id) : "");
  return address ? { id, name: apt.name, address } : null;
}

// Foxpost térképes automatakereső modális ablakban; csak a gomb megnyomásakor töltődik be (előtte nincs külső tartalom)
function FoxpostMapPicker({ onSelect, onClose }: { onSelect: (point: PickupPoint) => void; onClose: () => void }) {
  const { lang, dict } = useI18n();
  const frame = useRef<HTMLIFrameElement>(null);
  const onSelectRef = useRef(onSelect);

  // A legfrissebb visszahívást használjuk anélkül, hogy a figyelőt újra kellene kötni
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Csak a beágyazott Foxpost ablakból érkező üzenetet fogadjuk el
  useEffect(() => {
    // Üzenetfigyelő: forrás- és originellenőrzés után átvesszük a kiválasztott automatát
    function onMessage(event: MessageEvent) {
      // Más ablakból vagy idegen originről érkező üzenet
      if (event.source !== frame.current?.contentWindow || !FOXPOST_ORIGINS.has(event.origin)) {
        return;
      }
      const point = parseFoxpostMessage(event.data);
      // Értelmezhető választás esetén átadjuk
      if (point) {
        onSelectRef.current(point);
      }
    }
    // Escape bezárja az ablakot
    function onKeyDown(event: KeyboardEvent) {
      // Csak az Escape billentyű
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("message", onMessage);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="picker-modal" role="dialog" aria-modal="true" aria-label={dict.shipping.foxpostPickerTitle}>
      <div className="picker-modal-backdrop" onClick={onClose}></div>
      <div className="picker-modal-panel">
        <div className="picker-modal-head">
          <strong>{dict.shipping.foxpostPickerTitle}</strong>
          <button type="button" className="close-drawer" aria-label={dict.shipping.close} onClick={onClose}>
            ×
          </button>
        </div>
        <iframe
          ref={frame}
          className="picker-frame"
          src={`${FOXPOST_FINDER_URL}?lang=${lang === "hu" ? "hu" : "en"}`}
          title={dict.shipping.foxpostPickerTitle}
          loading="lazy"
        />
      </div>
    </div>
  );
}

// Átvételi pont választó: Foxpostnál térképes kereső, MPL-nél kézi megadás (pont neve + címe)
export default function PickupPointPicker({
  option,
  value,
  onChange,
  error,
}: {
  option: ShippingOption;
  value: PickupPoint | null;
  onChange: (point: PickupPoint | null) => void;
  error: string | null;
}) {
  const { dict } = useI18n();
  const [mapOpen, setMapOpen] = useState(false);
  const t = dict.shipping;

  // Foxpost: kiválasztott automata kártyája + térkép megnyitása
  if (option.picker === "foxpost-map") {
    return (
      <div className="pickup-picker">
        {value ? (
          <p className="pickup-selected">
            <strong>{value.name}</strong>
            <span>{value.address}</span>
          </p>
        ) : null}
        <button className="btn btn-outline-dark" type="button" onClick={() => setMapOpen(true)}>
          {value ? t.changePoint : t.choosePoint}
        </button>
        {error ? <small className="checkout-error">{error}</small> : null}
        {mapOpen ? (
          <FoxpostMapPicker
            onClose={() => setMapOpen(false)}
            onSelect={(point) => {
              onChange(point);
              setMapOpen(false);
            }}
          />
        ) : null}
      </div>
    );
  }

  // MPL: kézi megadás a posta.hu-n talált pont alapján
  const current = value ?? { id: "", name: "", address: "" };
  return (
    <div className="pickup-picker">
      <p className="muted">
        {t.mplManualHint}{" "}
        <a href={MPL_SITE_URL} target="_blank" rel="noopener noreferrer">
          posta.hu
        </a>
      </p>
      <div className="checkout-field-grid">
        <label className="checkout-field wide">
          <span>{t.pointName}</span>
          <input
            name="pickupPointName"
            value={current.name}
            onChange={(event) => onChange({ ...current, name: event.target.value })}
          />
        </label>
        <label className="checkout-field wide">
          <span>{t.pointAddress}</span>
          <input
            name="pickupPointAddress"
            value={current.address}
            onChange={(event) => onChange({ ...current, address: event.target.value })}
          />
        </label>
      </div>
      {error ? <small className="checkout-error">{error}</small> : null}
    </div>
  );
}
