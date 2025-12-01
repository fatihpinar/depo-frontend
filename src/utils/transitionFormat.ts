// src/utils/transitionFormat.ts
export type TransitionRow = {
  id: number;
  item_type: "component" | "product";
  item_id: number;
  action:
    | "CREATE" | "APPROVE" | "ASSEMBLE_PRODUCT"
    | "CONSUME" | "RETURN" | "MOVE"
    | "STATUS_CHANGE" | "ADJUST" | "ATTRIBUTE_CHANGE";
  qty_delta?: number | null;
  unit?: string | null;

  from_status_id?: number | null;
  to_status_id?: number | null;
  from_status_label?: string | null;
  to_status_label?: string | null;

  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  from_location_name?: string | null;
  to_location_name?: string | null;

  created_at: string;
  notes?: string | null;
  meta?: any;
};

const ACTION_LABEL_TR: Record<string, string> = {
  CREATE: "Yeni kayıt",
  APPROVE: "Onaylandı",
  ASSEMBLE_PRODUCT: "Ürün oluşturuldu",
  CONSUME: "Tüketim",
  RETURN: "İade",
  MOVE: "Yer değişti",
  STATUS_CHANGE: "Durum değişti",
  ADJUST: "Düzeltme",
  ATTRIBUTE_CHANGE: "Özellik değişti",
};

const STATUS_LABEL_FALLBACK_TR: Record<number, string> = {
  1: "Depoda",
  2: "Kullanıldı",
  3: "Satıldı",
  4: "Beklemede",
  5: "Hasarlı / Kayıp",
  6: "Üretimde",
  7: "Serigrafide",
};

const isNonEmpty = (x?: string | null) => typeof x === "string" && x.trim() !== "";

function qtyText(delta?: number | null, unit?: string | null): string | null {
  if (typeof delta !== "number" || !unit || delta === 0) return null;
  const sign = delta > 0 ? "+" : "−";
  return `${sign}${Math.abs(delta)} ${unit}`;
}

function titleFor(t: TransitionRow): string {
  const meta = t.meta || {};

  // 🔹 Özel kural: Component çıkışı ekranında hedef "Satış" ise
  // BE meta.target = "sale" gönderiyor → başlık "Satış" olsun.
  if (t.action === "CONSUME" && meta.target === "sale") {
    return "Satış";
  }

  // 🔹 MOVE her zaman "Yer değişti" kalsın
  if (t.action === "MOVE") return ACTION_LABEL_TR.MOVE;

  // 🔹 Önce statü label / fallback
  if (isNonEmpty(t.to_status_label)) {
    return String(t.to_status_label);
  }
  if (t.to_status_id && STATUS_LABEL_FALLBACK_TR[t.to_status_id]) {
    return STATUS_LABEL_FALLBACK_TR[t.to_status_id];
  }

  // 🔹 Aksi halde aksiyon sözlüğüne düş
  return ACTION_LABEL_TR[t.action] || String(t.action);
}


function humanDetailsTR(t: TransitionRow): string[] {
  const out: string[] = [];
  const m = t.meta || {};

  if (t.action === "ATTRIBUTE_CHANGE" && m.field === "barcode") {
    const before = isNonEmpty(m.before) ? m.before : "—";
    const after  = isNonEmpty(m.after)  ? m.after  : "—";
    out.push(`Barkod: ${before} → ${after}`);
  }

  if (t.action === "ADJUST") {
    if (typeof m.before_quantity === "number" && typeof m.after_quantity === "number") {
      const u = t.unit ? ` ${t.unit}` : "";
      out.push(`Miktar: ${m.before_quantity}${u} → ${m.after_quantity}${u}`);
    } else {
      out.push("Stok düzeltmesi yapıldı");
    }
  }

  if (t.action === "RETURN" && isNonEmpty(m.new_barcode)) {
    out.push(`Yeni barkod: ${m.new_barcode}`);
  }

  return out;
}

export type FormattedTransition = {
  title: string;
  placeLine: string | null;
  details: string[];
  extras: string[];
};

export function formatTransitionTR(t: TransitionRow): FormattedTransition {
  const title = titleFor(t);

  const fromWh = t.from_warehouse_name || null;
  const fromLc = t.from_location_name || null;
  const toWh   = t.to_warehouse_name   || null;
  const toLc   = t.to_location_name    || null;

  // NEW: BE fallback alanları (varsa)
  const curWh  = (t as any).current_warehouse_name || null;
  const curLc  = (t as any).current_location_name  || null;

  const show = (w?: string | null, l?: string | null) => `${w || "—"} / ${l || "—"}`;

  let placeLine: string | null = null;

  if (t.action === "MOVE") {
    // MOVE: daima ok ile iki taraf
    placeLine = `Yer: ${show(fromWh, fromLc)} → ${show(toWh, toLc)}`;
  } else {
    // Diğerleri: to || from || current
    const w = toWh ?? fromWh ?? curWh;
    const l = toLc ?? fromLc ?? curLc;
    placeLine = `Yer: ${show(w, l)}`;
  }

  const extras: string[] = [];
  const q = qtyText(t.qty_delta, t.unit);
  if (q) extras.push(q);
  if (isNonEmpty(t.meta?.new_barcode)) extras.push(`Yeni barkod: ${t.meta.new_barcode}`);

  const details = humanDetailsTR(t);

  return { title, placeLine, details, extras };
}
