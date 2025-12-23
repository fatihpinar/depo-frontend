// src/utils/numberFormat.ts
export type QtyFormatOptions = {
  maxFractionDigits?: number; // default 2
  decimalSeparator?: "," | "."; // default ","
  empty?: string; // default "—"
};

/**
 * - Tam sayıysa: "15"
 * - Küsürat varsa: "15,2" / "15,25" (max 2 hane)
 * - string/number alır: "15.000" gibi değerleri de parse eder
 */
export function formatQtyTR(
  value?: number | string | null,
  opts: QtyFormatOptions = {}
): string {
  const {
    maxFractionDigits = 2,
    decimalSeparator = ",",
    empty = "—",
  } = opts;

  if (value === null || value === undefined) return empty;

  const num =
    typeof value === "number"
      ? value
      : Number(String(value).trim().replace(",", "."));

  if (!Number.isFinite(num)) return empty;

  // Tam sayı
  if (Number.isInteger(num)) return String(num);

  // Küsürat: maxFractionDigits kadar
  const fixed = num.toFixed(maxFractionDigits);

  // "15.00" -> "15", "15.20" -> "15.2"
  const trimmed = fixed.replace(/\.?0+$/, "");

  return decimalSeparator === "," ? trimmed.replace(".", ",") : trimmed;
}
