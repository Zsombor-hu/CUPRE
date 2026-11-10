"use client";

// Címkézett beviteli mező hibaüzenettel, a pénztár űrlapjának (checkout-field) stílusában
export default function FormField({
  label,
  name,
  type = "text",
  value,
  onChange,
  error,
  autoComplete,
  hint,
  wide = false,
  readOnly = false,
}: {
  label: string;
  name: string;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
  autoComplete?: string;
  hint?: string;
  wide?: boolean;
  readOnly?: boolean;
}) {
  return (
    <label className={wide ? "checkout-field wide" : "checkout-field"}>
      <span>{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        autoComplete={autoComplete}
        readOnly={readOnly}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
      />
      {hint && !error ? <small className="field-hint">{hint}</small> : null}
      {error ? <small className="checkout-error">{error}</small> : null}
    </label>
  );
}
