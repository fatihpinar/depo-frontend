// src/pages/Product/ProductAssemble.tsx
import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import api from "../../services/api";
import { formatQtyTR } from "../../utils/numberFormat";
import { QrCode } from "lucide-react";
import BarcodeScannerModal from "../../components/scan/BarcodeScannerModal";

/* -------------------- Config -------------------- */
const RECIPES_BASE = "/recipes";

/* -------------------- Types -------------------- */
type RowTarget = "sale" | "stock";
type QtyMode = "unit" | "quantity";
type StockUnitCode = "area" | "weight" | "length" | "unit";

type RecipeRow = {
  recipe_id: number;   // ✅ number
  label: string;
};

type StockRow = {
  id: number;
  barcode: string;

  warehouse?: { id: number; name: string } | null;
  location?: { id: number; name: string } | null;

  master?: {
    id: number;
    display_label?: string | null;
    stock_unit?: { id: number; code: StockUnitCode | null; label?: string | null } | null;
  } | null;

  width?: number | null;
  height?: number | null;
  area?: number | null;

  weight?: number | null;
  length?: number | null;
};


type PickedComponent = {
  key: string;
  stock?: StockRow;
  qtyMode?: QtyMode;
  consumeQty?: number;
  open?: boolean;
  expectedMasterId?: number;
  expectedLabel?: string;
  rowTarget?: RowTarget;
  rowWarehouseId?: string;
  rowLocationId?: string;
};

type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };

/* -------------------- Helpers -------------------- */
const dash = <span className="text-gray-400 dark:text-gray-500">—</span>;

const unitCodeOf = (r: StockRow) => normalizeUnit(r.master?.stock_unit?.code || "");

const valueOf = (r: StockRow) => {
  const u = unitCodeOf(r);

  if (u === "area") return formatQtyTR(r.area);
  if (u === "weight") return formatQtyTR(r.weight);
  if (u === "length") return formatQtyTR(r.length);
  if (u === "unit") return "1";

  return "—";
};

const getMeasure = (r?: StockRow) => {
  if (!r) return { max: 0, label: "" };

  const u = normalizeUnit(r.master?.stock_unit?.code || "");

  if (u === "area") {
    const v = Number(r.area ?? 0);
    return { max: v, label: String(v) };
  }
  if (u === "weight") {
    const v = Number(r.weight ?? 0);
    return { max: v, label: String(v) };
  }
  if (u === "length") {
    const v = Number(r.length ?? 0);
    return { max: v, label: String(v) };
  }
  // unit
  return { max: 1, label: "1" };
};

function normalizeUnit(u?: string | null): string {
  return (u || "").toString().trim().toLowerCase();
}

function unitLabelTR(code?: StockUnitCode | string | null) {
  switch ((code || "").toString().toLowerCase()) {
    case "unit":
      return "Adet";
    case "length":
      return "m";
    case "weight":
      return "kg";
    case "area":
      return "m²";
    default:
      return "—";
  }
}

const safeRandomId = () =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  "id_" + Math.random().toString(36).slice(2, 10);

const normalizeBarcode = (v: any) =>
  String(v ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR");

const toneClass = (n: number, zeroIsRed = false) => {
  if (!Number.isFinite(n)) return "";
  if (zeroIsRed && n === 0) return "text-rose-600";
  if (n > 5) return "text-emerald-600";
  if (n >= 1) return "text-amber-600";
  return "";
};

const disabledWrap = (disabled: boolean) =>
  disabled ? "opacity-50 pointer-events-none" : "";

/* ==================================================== */

export default function ProductAssemble() {
  /* ---------- Tarif listesi & seçim ---------- */
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipeSelect, setRecipeSelect] = useState<string>("none");
  const [saveRecipeOpen, setSaveRecipeOpen] = useState(false);
  const [newRecipeName, setNewRecipeName] = useState("");
  const [savingRecipe, setSavingRecipe] = useState(false);

  const loadRecipes = async () => {
    try {
      const { data } = await api.get(RECIPES_BASE);
      const rows: RecipeRow[] = (data || []).map((r: any) => ({
        recipe_id: Number(r.id),              // ✅ id
        label: r.recipe_name || r.recipe_name || String(r.id),
      }));
      setRecipes(rows);
    } catch (e) {
      console.error("recipes fetch error:", e);
      setRecipes([]);
    }
  };

  useEffect(() => {
    loadRecipes();
  }, []);

  /* ---------- Depo/Lokasyon lookups (component exit için) ---------- */
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<
    Record<number, Location[]>
  >({});

  useEffect(() => {
    api
      .get("/lookups/warehouses")
      .then((r) => setWarehouses(r.data || []))
      .catch((e) => console.error("warehouses error:", e));
  }, []);

  const ensureLocations = async (wh: string | number) => {
    const id = Number(wh);
    if (!id) return [];
    if (locationsByWarehouse[id]) return locationsByWarehouse[id];
    try {
      const { data } = await api.get(`/lookups/locations?warehouseId=${id}`);
      const locs: Location[] = data || [];
      setLocationsByWarehouse((prev) => ({ ...prev, [id]: locs }));
      return locs;
    } catch (e) {
      console.error("locations error:", e);
      return [];
    }
  };

  /* ---------- Satırlar ---------- */
  const makeEmptyRow = (prefill?: {
    expectedMasterId?: number;
    expectedLabel?: string;
    qty?: number;
  }): { key: string; row: PickedComponent } => {
    const key = safeRandomId();
    const row: PickedComponent = {
      key,
      open: false,
      expectedMasterId: prefill?.expectedMasterId,
      expectedLabel: prefill?.expectedLabel,
      qtyMode: prefill?.qty ? "quantity" : "unit", // tariften qty gelirse quantity
      consumeQty: prefill?.qty,
      rowTarget: "sale",
      rowWarehouseId: "",
      rowLocationId: "",
    };
    return { key, row };
  };

  const initial = useMemo(() => makeEmptyRow(), []);
  const [components, setComponents] = useState<PickedComponent[]>([initial.row]);
  const buildRecipeItemsFromRows = () => {
  const rows = components.filter((c) => c.stock);

    if (!rows.length) {
      return { ok: false as const, message: "Tarif için en az 1 component seçmelisiniz." };
    }

    const items = rows.map((c) => {
      const stock = c.stock!;
      const masterId = stock.master?.id;
      if (!masterId) return null;

      const mode: QtyMode = c.qtyMode || "unit";
      const qty = mode === "unit" ? 1 : Number(c.consumeQty || 0);

      if (mode === "quantity" && (!qty || qty <= 0)) return null;

      const su = normalizeUnit(stock.master?.stock_unit?.code || "unit");
      const unit =
        mode === "unit"
          ? "EA"
          : su === "area"
            ? "M2"
            : su === "weight"
              ? "KG"
              : su === "length"
                ? "M"
                : "EA";

      return { component_master_id: masterId, qty, unit };
    });

    if (items.some((x) => x == null)) {
      return {
        ok: false as const,
        message: "Bazı satırlarda master/qty bilgisi eksik. Component seçimini kontrol edin.",
      };
    }

    return {
      ok: true as const,
      items: items as Array<{ component_master_id: number; qty: number; unit: string }>,
    };
  };


  const [search, setSearch] = useState<Record<string, string>>({
    [initial.key]: "",
  });
  const [choices, setChoices] = useState<Record<string, StockRow[]>>({});

  const resetRows = () => {
    const { key, row } = makeEmptyRow();
    setComponents([row]);
    setSearch({ [key]: "" });
    setChoices({});
  };

  /* ---------- Tarif seçimi: seçilince satırları doldur ---------- */
  const recipeSelectOptions = useMemo(() => {
    return [
      { value: "none", label: "Tarif seçiniz" },
      ...recipes.map((r) => ({ value: String(r.recipe_id), label: r.label })),
    ];
  }, [recipes]);

  const handleChangeRecipeSelect = async (val: string) => {
    setRecipeSelect(val || "none");

    // temizle
    setComponents([]);
    setSearch({});
    setChoices({});

    if (!val || val === "none") {
      resetRows();
      return;
    }

    try {
      const { data } = await api.get(`${RECIPES_BASE}/${val}/items`);
      const items: Array<{
        component_master_id: number;
        component_label: string;
        quantity: number;
      }> = data?.items || [];

      if (!items.length) {
        resetRows();
        return;
      }

      // tarif satırları -> prefill
      items.forEach((it) => {
        const { key, row } = makeEmptyRow({
          expectedMasterId: it.component_master_id,
          expectedLabel: it.component_label,
          qty: it.quantity,
        });
        setComponents((p) => [...p, row]);
        setSearch((s) => ({ ...s, [key]: it.component_label || "" }));
      });
    } catch (e) {
      console.error("recipe items fetch error:", e);
      resetRows();
    }
  };

  /* ---------- Picker ---------- */
  const selectedIds = useMemo(
    () => components.map((c) => c.stock?.id).filter(Boolean) as number[],
    [components]
  );

  const loadChoices = async (
    rowKey: string,
    q: string,
    expectedMasterId?: number
  ) => {
    try {
      const params: any = {
        search: q || undefined,
        availableOnly: true,
        statusId: 1,
      };
      if (expectedMasterId) params.masterId = expectedMasterId;

      const res = await api.get("/components", { params });

      const items: StockRow[] = (res.data || []).map((r: any) => ({
        id: r.id,
        barcode: r.barcode,
        warehouse: r.warehouse || null,
        location: r.location || null,
        master: r.master || null,
        width: r.width ?? null,
        height: r.height ?? null,
        area: r.area ?? null,
        weight: r.weight ?? null,
        length: r.length ?? null,
      }));

      setChoices((prev) => ({ ...prev, [rowKey]: items }));
      if (expectedMasterId) ensureMasterCount(expectedMasterId);
    } catch (e) {
      console.error("components fetch error:", e);
      setChoices((prev) => ({ ...prev, [rowKey]: [] }));
    }
  };

  const addComponentRow = () => {
    const { key, row } = makeEmptyRow();
    setComponents((p) => [...p, row]);
    setSearch((s) => ({ ...s, [key]: "" }));
  };

  const toggleDropdown = (idx: number, open?: boolean) => {
    setComponents((prev) =>
      prev.map((c, i) =>
        i === idx ? { ...c, open: open ?? !c.open } : { ...c, open: false }
      )
    );
    const row = components[idx];
    if (row) {
      const q = search[row.key] ?? "";
      loadChoices(row.key, q, row.expectedMasterId);
    }
  };

  const chooseComponent = (idx: number, row: StockRow) => {
    setComponents((prev) =>
      prev.map((item, i) => {
        if (i !== idx) return item;

        const mode: QtyMode = item.qtyMode || "unit";
        const m = getMeasure(row);

        return {
          ...item,
          stock: row,
          qtyMode: mode,
          consumeQty:
            mode === "quantity"
              ? typeof item.consumeQty === "number"
                ? item.consumeQty
                : m.max
              : undefined,
          open: false,
        };
      })
    );

    ensureMasterCount(row.master?.id);
  };

  const removeRow = (key: string) => {
    setComponents((prev) => prev.filter((c) => c.key !== key));
    setSearch((s) => {
      const n = { ...s };
      delete n[key];
      return n;
    });
    setChoices((p) => {
      const n = { ...p };
      delete n[key];
      return n;
    });
  };

  const setConsumeQty = (key: string, val: string) => {
    const num = Number(String(val).replace(",", ".") || 0);
    setComponents((prev) =>
      prev.map((c) =>
        c.key !== key
          ? c
          : {
            ...c,
            consumeQty: Number.isFinite(num) && num > 0 ? num : undefined,
          }
      )
    );
  };

  const setRowTarget = (key: string, val: RowTarget) => {
    setComponents((prev) =>
      prev.map((c) => {
        if (c.key !== key) return c;

        if (val === "stock") {
          // depo hedefinde adet dışı çıkış istemiyoruz
          return {
            ...c,
            rowTarget: "stock",
            qtyMode: "unit",
            consumeQty: undefined,
          };
        }
        return {
          ...c,
          rowTarget: "sale",
          rowWarehouseId: "",
          rowLocationId: "",
        };
      })
    );
  };

  const setRowWarehouse = async (key: string, v: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.key === key ? { ...c, rowWarehouseId: v, rowLocationId: "" } : c
      )
    );
    await ensureLocations(v);
  };

  const setRowLocation = (key: string, v: string) => {
    setComponents((prev) =>
      prev.map((c) => (c.key === key ? { ...c, rowLocationId: v } : c))
    );
  };

  /* ---------- Dışarı tıkla / ESC (dropdown kapat) ---------- */
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = e.target as HTMLElement;
      const inside = el.closest("[data-comp-picker]");
      if (!inside)
        setComponents((prev) => prev.map((c) => ({ ...c, open: false })));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape")
        setComponents((prev) => prev.map((c) => ({ ...c, open: false })));
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* ---------- Master stok sayısı (UI feedback) ---------- */
  const [masterCounts, setMasterCounts] = useState<Record<number, number>>({});

  const ensureMasterCount = async (masterId?: number) => {
    if (!masterId) return;
    if (masterCounts[masterId] !== undefined) return;

    try {
      const { data } = await api.get("/components", {
        params: { availableOnly: true, masterId, statusId: 1 },
      });
      const count = Array.isArray(data) ? data.length : 0;
      setMasterCounts((m) => ({ ...m, [masterId]: count }));
    } catch {
      setMasterCounts((m) => ({ ...m, [masterId]: 0 }));
    }
  };

  /* ---------- Global hedef/depo/lokasyon ---------- */
  const [globalRowTarget, setGlobalRowTarget] = useState<RowTarget | "">("");
  const [globalWarehouseId, setGlobalWarehouseId] = useState<string>("");
  const [globalLocationId, setGlobalLocationId] = useState<string>("");

  const handleChangeGlobalTarget = (v: string) => {
    const val = (v || "") as RowTarget | "";
    setGlobalRowTarget(val);
    if (val === "sale") {
      setGlobalWarehouseId("");
      setGlobalLocationId("");
    }
  };

  const applyGlobalToRows = async () => {
    if (!globalRowTarget) return;
    if (globalRowTarget === "stock") {
      if (!globalWarehouseId || !globalLocationId) return;
      await ensureLocations(globalWarehouseId);
    }

    setComponents((prev) =>
      prev.map((c) => {
        if (globalRowTarget === "sale") {
          return {
            ...c,
            rowTarget: "sale",
            rowWarehouseId: "",
            rowLocationId: "",
          };
        }
        return {
          ...c,
          rowTarget: "stock",
          rowWarehouseId: globalWarehouseId,
          rowLocationId: globalLocationId,
          qtyMode: "unit",
          consumeQty: undefined,
        };
      })
    );
  };

  const canApplyAll =
    !!globalRowTarget &&
    components.length > 0 &&
    (globalRowTarget === "sale" ||
      (globalRowTarget === "stock" &&
        !!globalWarehouseId &&
        !!globalLocationId));

  /* ---------- Validasyon ---------- */
  const componentsValid =
    components.length > 0 &&
    components.every((c) => {
      if (!c.stock) return false;

      const mode: QtyMode = c.qtyMode || "unit";
      if (mode === "unit") return true;

      const m = getMeasure(c.stock);
      const q = Number(c.consumeQty || 0);
      return q > 0 && q <= (m.max ?? 0);
    });

  const componentExitValid =
    componentsValid &&
    components.every((c) => {
      if (!c.stock) return false;
      const t: RowTarget = c.rowTarget || "sale";
      if (t === "sale") return true;
      return !!c.rowWarehouseId && !!c.rowLocationId;
    });

  /* ---------- Kaydet: component exit ---------- */
  const handleSaveComponentExit = async () => {
    try {
      if (!componentExitValid) {
        alert("Satır hedefleri veya alanlar eksik / geçersiz.");
        return;
      }

      const rowsPayload = components.map((c) => {
        if (!c.stock) throw new Error("Eksik component seçimi var.");
        const t: RowTarget = c.rowTarget || "sale";
        const mode: QtyMode = c.qtyMode || "unit";

        return {
          component_id: c.stock.id,
          mode,
          consume_qty: mode === "quantity" ? Number(c.consumeQty || 0) : undefined,
          target: t,
          warehouse_id:
            t === "stock" && c.rowWarehouseId
              ? Number(c.rowWarehouseId)
              : undefined,
          location_id:
            t === "stock" && c.rowLocationId
              ? Number(c.rowLocationId)
              : undefined,
        };
      });

      const recipe_id =
      recipeSelect && recipeSelect !== "none" ? Number(recipeSelect) : null;

      await api.post("/components/exit", {
        recipe_id,
        rows: rowsPayload,
      });

      alert("Component çıkışı kaydedildi.");

      resetRows();
      setRecipeSelect("none");
      setGlobalRowTarget("");
      setGlobalWarehouseId("");
      setGlobalLocationId("");
      setMasterCounts({});
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Hata";
      alert(`Component çıkışı hatası: ${msg}`);
      console.error("component exit error", err?.response?.data || err);
    }
  };

  /* =========================
     2) QR ile satır ekleme
     ========================= */
  const [scanOpen, setScanOpen] = useState(false);

  const closeScanner = () => setScanOpen(false);
  const openScanner = () => setScanOpen(true);

  // Barkoddan komponent bul (availableOnly + statusId=1)
  const findComponentByBarcode = async (barcode: string): Promise<StockRow | null> => {
    const code = normalizeBarcode(barcode);
    if (!code) return null;

    const res = await api.get("/components", {
      params: { search: code, availableOnly: true, statusId: 1 },
    });

    const items: StockRow[] = (res.data || []).map((r: any) => ({
      id: r.id,
      barcode: r.barcode,
      warehouse: r.warehouse || null,
      location: r.location || null,
      master: r.master || null,
      width: r.width ?? null,
      height: r.height ?? null,
      area: r.area ?? null,
      weight: r.weight ?? null,
      length: r.length ?? null,
    }));


    // exact barkod eşleştirme (en güvenlisi)
    const hit = items.find((x) => normalizeBarcode(x.barcode) === code);
    return hit || null;
  };

  const handleScanResult = async (text: string) => {
    const code = normalizeBarcode(text);
    closeScanner();

    try {
      const hit = await findComponentByBarcode(code);
      if (!hit) {
        alert("Bu barkoda ait uygun (stokta) komponent bulunamadı.");
        return;
      }

      // aynı component zaten seçili mi?
      const already = components.some((c) => c.stock?.id === hit.id);
      if (already) {
        alert("Bu komponent zaten listede seçili.");
        return;
      }

      // 1) ilk boş satır varsa oraya koy
      const emptyIdx = components.findIndex((c) => !c.stock);
      if (emptyIdx >= 0) {
        chooseComponent(emptyIdx, hit);
        setSearch((s) => ({ ...s, [components[emptyIdx].key]: hit.barcode }));
        return;
      }

      // 2) yoksa yeni satır ekle ve ona koy
      const { key, row } = makeEmptyRow();
      const newIndex = components.length;

      setComponents((p) => [...p, row]);
      setSearch((s) => ({ ...s, [key]: hit.barcode }));

      // state settle sonrası seçimi uygula
      setTimeout(() => {
        chooseComponent(newIndex, hit);
      }, 0);
    } catch (e) {
      console.error(e);
      alert("Barkod okuma sırasında hata oluştu.");
    }
  };

  /* ==================================================== */
  return (
    <div className="space-y-6">
      <PageMeta
        title="Component Çıkışı"
        description="Stoktaki kalemlerden çıkış yap"
      />
      <PageBreadcrumb pageTitle="Component Çıkışı" />

      {/* TARİF */}
      <ComponentCard title="Tarif (Opsiyonel)">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Tarif</Label>
            <Select
              options={recipeSelectOptions}
              value={recipeSelect}
              onChange={handleChangeRecipeSelect}
              placeholder="Tarif seçiniz"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Tarif seçerseniz satırlar otomatik dolar. Seçmezseniz manuel
              ekleyebilirsiniz.
            </p>
          </div>
        </div>
      </ComponentCard>

      {/* COMPONENTLER */}
      <ComponentCard title="Componentler">
        {/* Global hedef */}
        <div className="mb-4 space-y-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto]">
            <div>
              <Label>Hedef</Label>
              <Select
                options={[
                  { value: "", label: "Seçiniz", disabled: true },
                  { value: "sale", label: "Satış" },
                  { value: "stock", label: "Depo" },
                ]}
                value={globalRowTarget || ""}
                onChange={handleChangeGlobalTarget}
                placeholder="Seçiniz"
              />
            </div>

            <div>
              <Label>Varsayılan Depo</Label>
              <Select
                options={[
                  { value: "", label: "Seçiniz", disabled: true },
                  ...warehouses.map((w) => ({
                    value: String(w.id),
                    label: w.name,
                  })),
                ]}
                value={globalWarehouseId}
                onChange={async (v: string) => {
                  setGlobalWarehouseId(v);
                  setGlobalLocationId("");
                  if (v && globalRowTarget === "stock") {
                    const locs = await ensureLocations(v);
                    if (locs.length === 1)
                      setGlobalLocationId(String(locs[0].id));
                  }
                }}
                placeholder="Seçiniz"
                disabled={globalRowTarget !== "stock"}
              />
            </div>

            <div>
              <Label>Varsayılan Lokasyon</Label>
              <Select
                options={[
                  { value: "", label: "Seçiniz", disabled: true },
                  ...(globalWarehouseId
                    ? locationsByWarehouse[Number(globalWarehouseId)] || []
                    : []
                  ).map((l) => ({ value: String(l.id), label: l.name })),
                ]}
                value={globalLocationId}
                onChange={(v: string) => setGlobalLocationId(v)}
                placeholder="Seçiniz"
                disabled={globalRowTarget !== "stock"}
              />
            </div>

            <div className="flex items-end justify-end md:justify-start gap-2">
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={applyGlobalToRows}
                disabled={!canApplyAll}
              >
                Tümüne Uygula
              </Button>
            </div>
          </div>
        </div>

        {/* Satırlar */}
        <div className="space-y-4">
          {components.map((c, idx) => {
            const selected = c.stock;
            const q = search[c.key] ?? "";
            const allRows = choices[c.key] ?? [];

            const visibleRows = allRows
              .filter((r) => r.id === selected?.id || !selectedIds.includes(r.id))
              .sort((a, b) => {
                const em = c.expectedMasterId;
                if (!em) return 0;
                const aa = (a.master?.id ?? 0) === em ? 0 : 1;
                const bb = (b.master?.id ?? 0) === em ? 0 : 1;
                return aa - bb;
              });

            const rowTarget: RowTarget = c.rowTarget || "sale";

            const whOptions = [
              { value: "", label: "Depo", disabled: true },
              ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
            ];

            const locOptions = [
              { value: "", label: "Lokasyon", disabled: true },
              ...(c.rowWarehouseId
                ? locationsByWarehouse[Number(c.rowWarehouseId)] || []
                : []
              ).map((l) => ({ value: String(l.id), label: l.name })),
            ];

            return (
              <div
                key={c.key}
                className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4"
              >
                {/* MOBILE */}
                <div className="block md:hidden">
                  <div className="mb-3 flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={() => removeRow(c.key)}>
                      Kaldır
                    </Button>
                  </div>

                  <div className="space-y-3">
                    <div data-comp-picker className="relative">
                      <Label>Component</Label>
                      <div
                        role="button"
                        tabIndex={0}
                        aria-expanded={c.open ? "true" : "false"}
                        onClick={() => toggleDropdown(idx)}
                        className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 cursor-pointer flex items-center justify-between dark:border-gray-700 dark:text-white/90"
                      >
                        <span className="truncate">
                          {selected
                            ? `${selected.barcode} — ${selected.master?.display_label ?? ""}`
                            : c.expectedLabel
                              ? `Beklenen: ${c.expectedLabel}`
                              : "Component seçin"}
                        </span>
                        <span className="ml-3 opacity-60">▾</span>
                      </div>

                      {c.open && (
                        <div className="absolute z-20 mt-2 w-[min(920px,92vw)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                          <div className="mb-3">
                            <Input
                              placeholder="Ara (barkod / tanım…)"
                              value={q}
                              onChange={(e) => {
                                const val = e.target.value;
                                setSearch((s) => ({ ...s, [c.key]: val }));
                                loadChoices(c.key, val, c.expectedMasterId);
                              }}
                            />
                          </div>

                          {/* 1) Mini tablo kolonları + doğru değerler */}
                          <div className="max-h-[320px] overflow-auto">
                            <table className="min-w-[900px] w-full text-sm">
                              <thead>
                                <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  <th className="px-3 py-2">Barkod</th>
                                  <th className="px-3 py-2">Tanım</th>
                                  <th className="px-3 py-2">Miktar</th>
                                  <th className="px-3 py-2">Ölçü Birimi</th>
                                  <th className="px-3 py-2">Depo</th>
                                  <th className="px-3 py-2">Lokasyon</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-900 dark:text-gray-100">
                                {visibleRows.length ? (
                                  visibleRows.map((r) => (
                                    <tr
                                      key={r.id}
                                      role="button"
                                      tabIndex={0}
                                      aria-selected={selected?.id === r.id}
                                      onClick={() => chooseComponent(idx, r)}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                          e.preventDefault();
                                          chooseComponent(idx, r);
                                        }
                                      }}
                                      className={`cursor-pointer transition ${selected?.id === r.id
                                          ? "bg-brand-500/5 dark:bg-brand-500/10"
                                          : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                        }`}
                                    >
                                      <td className="px-3 py-2">{r.barcode}</td>
                                      <td className="px-3 py-2">{r.master?.display_label ?? dash}</td>
                                      <td className="px-3 py-2">{valueOf(r)}</td>
                                      <td className="px-3 py-2">{unitLabelTR(r.master?.stock_unit?.code ?? null)}</td>
                                      <td className="px-3 py-2">{r.warehouse?.name ?? dash}</td>
                                      <td className="px-3 py-2">{r.location?.name ?? dash}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td
                                      className="px-3 py-6 text-gray-500 dark:text-gray-400"
                                      colSpan={6}
                                    >
                                      Kayıt bulunamadı
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button
                              variant="outline"
                              onClick={() => toggleDropdown(idx, false)}
                            >
                              Kapat
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label>Çıkış Şekli</Label>
                        <Select
                          options={[
                            { value: "unit", label: "Adet" },
                            { value: "quantity", label: "Miktar" },
                          ]}
                          value={c.qtyMode || "unit"}
                          onChange={(v: string) => {
                            const mode = (v as QtyMode) || "unit";
                            setComponents((prev) =>
                              prev.map((x) => {
                                if (x.key !== c.key) return x;
                                if ((x.rowTarget || "sale") === "stock") {
                                  return { ...x, qtyMode: "unit", consumeQty: undefined };
                                }
                                if (mode === "unit") return { ...x, qtyMode: "unit", consumeQty: undefined };
                                const m = getMeasure(x.stock);
                                return { ...x, qtyMode: "quantity", consumeQty: m.max || undefined };
                              })
                            );
                          }}
                          disabled={rowTarget === "stock"}
                          placeholder="Seçiniz"
                        />
                      </div>

                      <div>
                        <Label>Hedef</Label>
                        <Select
                          options={[
                            { value: "sale", label: "Satış" },
                            { value: "stock", label: "Depo" },
                          ]}
                          value={rowTarget}
                          onChange={(v: string) => setRowTarget(c.key, v as RowTarget)}
                          placeholder="Seçiniz"
                        />
                      </div>
                    </div>

                    <div>
                      {(() => {
                        const mode = c.qtyMode || "unit";
                        const m = getMeasure(selected);
                        const label =
                          mode === "unit"
                            ? "Miktar (Adet)"
                            : `Miktar (${unitLabelTR(selected?.master?.stock_unit?.code ?? null)})`;

                        return (
                          <>
                            <Label>{label}</Label>
                            <Input
                              type="number"
                              min="0"
                              max={String(m.max || 0)}
                              value={mode === "quantity" ? c.consumeQty ?? "" : ""}
                              onChange={(e) => setConsumeQty(c.key, e.target.value)}
                              placeholder={mode === "quantity" && selected ? `0 - ${m.max}` : ""}
                              disabled={mode !== "quantity" || !selected}
                              className="w-full"
                            />
                          </>
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div className={disabledWrap(rowTarget !== "stock")}>
                        <Label>Depo</Label>
                        <Select
                          options={whOptions}
                          value={c.rowWarehouseId || ""}
                          onChange={(v: string) => setRowWarehouse(c.key, v)}
                          placeholder="Depo"
                          disabled={rowTarget !== "stock"}
                        />
                      </div>

                      <div className={disabledWrap(rowTarget !== "stock" || !c.rowWarehouseId)}>
                        <Label>Lokasyon</Label>
                        <Select
                          options={locOptions}
                          value={c.rowLocationId || ""}
                          onChange={(v: string) => setRowLocation(c.key, v)}
                          placeholder="Lokasyon"
                          disabled={rowTarget !== "stock" || !c.rowWarehouseId}
                        />
                      </div>
                    </div>

                    {selected && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(() => {
                          const mode: QtyMode = c.qtyMode || "unit";
                          const masterId = selected.master?.id ?? 0;

                          if (mode === "unit") {
                            const total = masterCounts[masterId];
                            const hasTotal = typeof total === "number";
                            return (
                              <>
                                Depoda:{" "}
                                <span className={toneClass(Number(total ?? NaN), true)}>
                                  {hasTotal ? total : "…"}
                                </span>
                              </>
                            );
                          }

                          const m = getMeasure(selected);
                          const used = Number(c.consumeQty || 0);
                          const after = Math.max(0, (m.max || 0) - used);

                          return (
                            <>
                              Mevcut:{" "}
                              <span className={toneClass(m.max, true)}>{m.max}</span> • Sonrası:{" "}
                              <span className={toneClass(after, true)}>{after}</span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* DESKTOP */}
                <div className="hidden md:block">
                  <div className="space-y-2">
                    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-3 items-center">
                      <div data-comp-picker className="relative">
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={c.open ? "true" : "false"}
                          onClick={() => toggleDropdown(idx)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 cursor-pointer flex items-center justify-between dark:border-gray-700 dark:text-white/90"
                        >
                          <span className="truncate">
                            {selected
                              ? `${selected.barcode} — ${selected.master?.display_label ?? ""}`
                              : c.expectedLabel
                                ? `Beklenen: ${c.expectedLabel}`
                                : "Component seçin"}
                          </span>
                          <span className="ml-3 opacity-60">▾</span>
                        </div>

                        {c.open && (
                          <div className="absolute z-20 mt-2 w-[min(920px,92vw)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                            <div className="mb-3">
                              <Input
                                placeholder="Ara (barkod / tanım…)"
                                value={q}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setSearch((s) => ({ ...s, [c.key]: val }));
                                  loadChoices(c.key, val, c.expectedMasterId);
                                }}
                              />
                            </div>

                            {/* 1) Mini tablo kolonları + doğru değerler */}
                            <div className="max-h-[320px] overflow-auto">
                              <table className="min-w-[900px] w-full text-sm">
                                <thead>
                                  <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                    <th className="px-3 py-2">Barkod</th>
                                    <th className="px-3 py-2">Tanım</th>
                                    <th className="px-3 py-2">Miktar</th>
                                    <th className="px-3 py-2">Ölçü Birimi</th>
                                    <th className="px-3 py-2">Depo</th>
                                    <th className="px-3 py-2">Lokasyon</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-900 dark:text-gray-100">
                                  {visibleRows.length ? (
                                    visibleRows.map((r) => (
                                      <tr
                                        key={r.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-selected={selected?.id === r.id}
                                        onClick={() => chooseComponent(idx, r)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            chooseComponent(idx, r);
                                          }
                                        }}
                                        className={`cursor-pointer transition ${selected?.id === r.id
                                            ? "bg-brand-500/5 dark:bg-brand-500/10"
                                            : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                          }`}
                                      >
                                        <td className="px-3 py-2">{r.barcode}</td>
                                        <td className="px-3 py-2">{r.master?.display_label ?? dash}</td>
                                        <td className="px-3 py-2">{valueOf(r)}</td>
                                        <td className="px-3 py-2">
                                          {unitLabelTR(r.master?.stock_unit?.code ?? null)}
                                        </td>
                                        <td className="px-3 py-2">{r.warehouse?.name ?? dash}</td>
                                        <td className="px-3 py-2">{r.location?.name ?? dash}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-3 py-6 text-gray-500 dark:text-gray-400" colSpan={6}>
                                        Kayıt bulunamadı
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <Button
                                variant="outline"
                                onClick={() => toggleDropdown(idx, false)}
                              >
                                Kapat
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      <Select
                        options={[
                          { value: "sale", label: "Satış" },
                          { value: "stock", label: "Depo" },
                        ]}
                        value={rowTarget}
                        onChange={(v: string) => setRowTarget(c.key, v as RowTarget)}
                        placeholder="Hedef"
                      />

                      <Select
                        options={[
                          { value: "unit", label: "Adet" },
                          { value: "quantity", label: "Miktar" },
                        ]}
                        value={c.qtyMode || "unit"}
                        onChange={(v: string) => {
                          const mode = (v as QtyMode) || "unit";
                          setComponents((prev) =>
                            prev.map((x) => {
                              if (x.key !== c.key) return x;
                              if ((x.rowTarget || "sale") === "stock") {
                                return { ...x, qtyMode: "unit", consumeQty: undefined };
                              }
                              if (mode === "unit") return { ...x, qtyMode: "unit", consumeQty: undefined };
                              const m = getMeasure(x.stock);
                              return { ...x, qtyMode: "quantity", consumeQty: m.max || undefined };
                            })
                          );
                        }}
                        disabled={rowTarget === "stock"}
                        placeholder="Ölçü Birimi"
                      />

                      {(() => {
                        const mode = c.qtyMode || "unit";
                        const m = getMeasure(selected);
                        return (
                          <Input
                            type="number"
                            min="0"
                            max={String(m.max || 0)}
                            value={mode === "quantity" ? c.consumeQty ?? "" : ""}
                            onChange={(e) => setConsumeQty(c.key, e.target.value)}
                            placeholder={
                              mode === "unit"
                                ? "Adet"
                                : selected
                                  ? unitLabelTR(selected?.master?.stock_unit?.code ?? null)
                                  : "Miktar"
                            }
                            disabled={mode !== "quantity" || !selected}
                          />
                        );
                      })()}
                    </div>

                    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-3 items-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {selected ? (
                          (() => {
                            const mode: QtyMode = c.qtyMode || "unit";
                            const masterId = selected.master?.id ?? 0;

                            if (mode === "unit") {
                              const total = masterCounts[masterId];
                              const hasTotal = typeof total === "number";
                              return (
                                <>
                                  Depoda:{" "}
                                  <span className={toneClass(Number(total ?? NaN), true)}>
                                    {hasTotal ? total : "…"}
                                  </span>
                                </>
                              );
                            }

                            const m = getMeasure(selected);
                            const used = Number(c.consumeQty || 0);
                            const after = Math.max(0, (m.max || 0) - used);

                            return (
                              <>
                                Mevcut:{" "}
                                <span className={toneClass(m.max, true)}>{m.max}</span> • Sonrası:{" "}
                                <span className={toneClass(after, true)}>{after}</span>
                              </>
                            );
                          })()
                        ) : c.expectedLabel ? (
                          `Beklenen: ${c.expectedLabel}`
                        ) : (
                          "—"
                        )}
                      </div>

                      <Select
                        options={whOptions}
                        value={c.rowWarehouseId || ""}
                        onChange={(v: string) => setRowWarehouse(c.key, v)}
                        placeholder="Depo"
                        disabled={rowTarget !== "stock"}
                      />

                      <Select
                        options={locOptions}
                        value={c.rowLocationId || ""}
                        onChange={(v: string) => setRowLocation(c.key, v)}
                        placeholder="Lokasyon"
                        disabled={rowTarget !== "stock" || !c.rowWarehouseId}
                      />

                      <Button variant="outline" onClick={() => removeRow(c.key)}>
                        Kaldır
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Satır ekleme aksiyonları */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex gap-2">
              <Button variant="primary" onClick={addComponentRow}>
                Component Ekle
              </Button>

              <Button variant="outline" onClick={openScanner}>
                <span className="inline-flex items-center gap-2">
                  <QrCode className="h-4 w-4" />
                  Barkod Oku
                </span>
              </Button>
            </div>

            {/* İstersen sağ tarafa küçük bilgi koyabiliriz */}
            {/* <div className="text-xs text-gray-500 dark:text-gray-400">Satır: {components.length}</div> */}
          </div>

          <div className="mt-6 flex items-center justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                const built = buildRecipeItemsFromRows();
                if (!built.ok) return alert(built.message);
                setNewRecipeName("");
                setSaveRecipeOpen(true);
              }}
              disabled={!componentsValid} // istersen componentExitValid da yapabilirsin
            >
              Tarifi Kaydet
            </Button>

            <Button
              variant="primary"
              disabled={!componentExitValid}
              onClick={handleSaveComponentExit}
            >
              Kaydet
            </Button>
          </div>
        </div>
      </ComponentCard>
      {saveRecipeOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-4 shadow-xl dark:border-gray-800 dark:bg-gray-900">
            <div className="mb-3 text-lg font-semibold text-gray-900 dark:text-gray-100">
              Tarif Kaydet
            </div>

            <div className="space-y-2">
              <Label>Tarif Adı</Label>
              <Input
                value={newRecipeName}
                onChange={(e) => setNewRecipeName(e.target.value)}
                placeholder="Örn: Tarif Test"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Tarif, ekrandaki seçili component satırlarından oluşturulacak.
              </p>
            </div>

            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setSaveRecipeOpen(false)}
                disabled={savingRecipe}
              >
                İptal
              </Button>

              <Button
                variant="primary"
                disabled={savingRecipe}
                onClick={async () => {
                  const name = (newRecipeName || "").trim();
                  if (!name) return alert("Tarif adı giriniz.");

                  const built = buildRecipeItemsFromRows();
                  if (!built.ok) return alert(built.message);

                  try {
                    setSavingRecipe(true);
                    const { data } = await api.post(RECIPES_BASE, {
                      recipe_name: name,
                      items: built.items,
                    });

                    alert("Tarif kaydedildi.");

                    setSaveRecipeOpen(false);
                    setNewRecipeName("");

                    // listeyi yenile ve yeni tarifi seç
                    await loadRecipes();
                    if (data?.id) setRecipeSelect(String(data.id));
                  } catch (err: any) {
                    const msg =
                      err?.response?.data?.message ||
                      err?.message ||
                      "Tarif kaydedilemedi.";
                    alert(msg);
                    console.error("recipe create error", err?.response?.data || err);
                  } finally {
                    setSavingRecipe(false);
                  }
                }}
              >
                Kaydet
              </Button>
            </div>
          </div>
        </div>
      )}        
      {/* Scanner Modal */}
      <BarcodeScannerModal open={scanOpen} onClose={closeScanner} onResult={handleScanResult} />
    </div>
  );
}
