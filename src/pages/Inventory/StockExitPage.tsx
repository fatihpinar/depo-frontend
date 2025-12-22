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

/* -------------------- Config -------------------- */
const RECIPES_BASE = "/products/recipes";

/* -------------------- Types -------------------- */
type Target = "production" | "screenprint" | "stock";
type ExitMode = "component" | "product";
type RowTarget = "sale" | "stock";
type QtyMode = "unit" | "quantity";
type StockUnit = "area" | "weight" | "length" | "unit" | string;

type RecipeRow = {
  recipe_id: string;
  recipe_name: string;
  label: string;
};

type StockRow = {
  id: number;
  barcode: string;
  name: string | null;
  bimeks_code?: string | null;
  stock_unit?: StockUnit | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  length?: number | null;
  area: number;
  areaUnit: string;
  warehouse: { id: number; name: string };
  location: { id: number; name: string };
  master_id: number;
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

/* -------------------- Helper Functions -------------------- */
const safeRandomId = () =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  "id_" + Math.random().toString(36).slice(2, 10);

const norm = (v: any) => String(v ?? "").toLowerCase().trim();

const toneClass = (n: number, zeroIsRed = false) => {
  if (!Number.isFinite(n)) return "";
  if (zeroIsRed && n === 0) return "text-rose-600";
  if (n > 5) return "text-emerald-600";
  if (n >= 1) return "text-amber-600";
  return "";
};

const unitLabelTR = (u?: string | null) => {
  const x = norm(u);
  if (x === "area") return "Alan";
  if (x === "weight") return "Ağırlık";
  if (x === "length") return "Uzunluk";
  if (x === "unit") return "Adet";
  return "—";
};

const getMeasure = (r?: StockRow) => {
  if (!r) return { value: 0, label: "", max: 0 };

  const u = norm(r.stock_unit);
  if (u === "area") {
    const v = Number(r.area ?? 0);
    return { value: v, max: v, label: `${v} ${r.areaUnit || ""}`.trim() };
  }
  if (u === "weight") {
    const v = Number(r.weight ?? 0);
    return { value: v, max: v, label: `${v}` };
  }
  if (u === "length") {
    const v = Number(r.length ?? 0);
    return { value: v, max: v, label: `${v}` };
  }
  const v = 1;
  return { value: v, max: v, label: `1` };
};

const getStockUnitDisplay = (stockUnit?: string | null) => {
  const u = String(stockUnit || "").toLowerCase();
  if (u === "area") return "Alan";
  if (u === "weight") return "Ağırlık";
  if (u === "length") return "Uzunluk";
  if (u === "unit") return "Adet";
  return "—";
};

const getStockValueDisplay = (r: StockRow) => {
  const u = String(r.stock_unit || "").toLowerCase();

  if (u === "area") {
    return (
      <span className="whitespace-nowrap">
        En: {r.width ?? "—"} • Boy: {r.height ?? "—"} • Alan: {r.area ?? "—"} {r.areaUnit || ""}
      </span>
    );
  }
  if (u === "weight") return <span>{r.weight ?? "—"}</span>;
  if (u === "length") return <span>{r.length ?? "—"}</span>;
  if (u === "unit") return <span>Adet</span>;

  return "—";
};

const disabledWrap = (disabled: boolean) =>
  disabled ? "opacity-50 pointer-events-none" : "";

/* ==================================================== */

export default function StockExitPage() {
  /* ---------- ÇIKIŞ MODU ---------- */
  const [exitMode, setExitMode] = useState<ExitMode>("component");

  /* ---------- ÜRÜN BİLGİSİ ---------- */
  const [productName, setProductName] = useState<string>("");

  /* ---------- Tarif listesi & seçim ---------- */
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipeSelect, setRecipeSelect] = useState<string>("none");
  const [newRecipeName, setNewRecipeName] = useState<string>("");

  const loadRecipes = async () => {
    try {
      const { data } = await api.get(RECIPES_BASE);
      const rows: RecipeRow[] = (data || []).map((r: any) => ({
        recipe_id: r.recipe_id,
        recipe_name: r.recipe_name || r.display_label || r.recipe_id,
        label: r.recipe_name || r.display_label || r.recipe_id,
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

  /* ---------- Helper: Yeni satır oluşturma ---------- */
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
      qtyMode: exitMode === "product" ? "quantity" : "unit",
      consumeQty: prefill?.qty,
      rowTarget: "sale",
      rowWarehouseId: "",
      rowLocationId: "",
    };
    return { key, row };
  };

  const initial = useMemo(() => makeEmptyRow(), []);

  /* ---------- Components ---------- */
  const [components, setComponents] = useState<PickedComponent[]>([initial.row]);
  const [search, setSearch] = useState<Record<string, string>>({ [initial.key]: "" });
  const [choices, setChoices] = useState<Record<string, StockRow[]>>({});

  /* ---------- Finalize (sadece ürün oluşturma için) ---------- */
  const [showFinalize, setShowFinalize] = useState(false);
  const [target, setTarget] = useState<Target | "">("");
  const [bimeksCode, setBimeksCode] = useState<string>("");

  // Depo/Lokasyon (hedef=Depo, ürün oluşturma modu)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<
    Record<number, Location[]>
  >({});
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");

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

  const selectedIds = useMemo(
    () => components.map((c) => c.stock?.id).filter(Boolean) as number[],
    [components]
  );

  /* ---------- Options ---------- */
  const exitModeOptions = useMemo(
    () => [
      { value: "component", label: "Component çıkışı" },
      { value: "product", label: "Ürün oluşturma" },
    ],
    []
  );

  const targetOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true },
      { value: "production", label: "Üretim" },
      { value: "screenprint", label: "Serigrafi" },
      { value: "stock", label: "Depo" },
    ],
    []
  );

  const recipeSelectOptions = useMemo(() => {
    if (exitMode !== "product") return [];
    return [
      { value: "none", label: "Tarifsiz (manuel oluşturma)" },
      ...recipes.map((r) => ({ value: r.recipe_id, label: r.label })),
      { value: "new", label: "Yeni tarif oluştur" },
    ];
  }, [exitMode, recipes]);

  /* ---------- FE: master bazında toplam stok (cache) ---------- */
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

  const recipeReady = useMemo(() => {
    if (exitMode !== "product") return true;
    if (recipeSelect === "new") return !!newRecipeName.trim();
    return true;
  }, [exitMode, recipeSelect, newRecipeName]);

  const productFinalizeValid =
    exitMode === "product" &&
    recipeReady &&
    componentsValid &&
    !!target &&
    !!productName.trim() &&
    (target !== "stock" || (warehouseId && locationId));

  const componentExitValid =
    exitMode === "component" &&
    componentsValid &&
    components.length > 0 &&
    components.every((c) => {
      if (!c.stock) return false;
      const t: RowTarget = c.rowTarget || "sale";
      if (t === "sale") return true;
      return !!c.rowWarehouseId && !!c.rowLocationId;
    });

  /* ---------- finalize'ı sıfırlayan yardımcı ---------- */
  const invalidateFinalize = () => {
    if (showFinalize) setShowFinalize(false);
    setTarget("");
    setWarehouseId("");
    setLocationId("");
    setBimeksCode("");
    setProductName("");
  };

  const resetRows = () => {
    const { key, row } = makeEmptyRow();
    setComponents([row]);
    setSearch({ [key]: "" });
    setChoices({});
  };

  /* ---------- API: picker ---------- */
  const loadChoices = async (rowKey: string, q: string, expectedMasterId?: number) => {
    try {
      const params: any = { search: q || undefined, availableOnly: true, statusId: 1 };
      if (expectedMasterId) params.masterId = expectedMasterId;

      const res = await api.get("/components", { params });
      const items: StockRow[] = (res.data || []).map((r: any) => {
        const lengthUnit = r.master?.length_unit || r.master_length_unit || "";
        const areaUnit =
          lengthUnit === "um"
            ? "um²"
            : lengthUnit === "m"
              ? "m²"
              : lengthUnit
                ? `${lengthUnit}²`
                : "";

        const stockUnit =
          r.master?.stock_unit || r.master_stock_unit || r.stock_unit || "";

        return {
          id: r.id,
          barcode: r.barcode,
          name:
            r.master?.bimeks_product_name ||
            r.master_bimeks_product_name ||
            r.bimeks_product_name ||
            null,
          bimeks_code:
            r.master?.bimeks_code || r.master_bimeks_code || r.bimeks_code || null,
          stock_unit: stockUnit,
          width: r.width ?? null,
          height: r.height ?? null,
          weight: r.weight ?? null,
          length: r.length ?? null,
          area: Number(r.area ?? 0),
          areaUnit,
          warehouse: r.warehouse || { id: 0, name: "-" },
          location: r.location || { id: 0, name: "-" },
          master_id: r.master?.id ?? r.master_id,
        };
      });

      setChoices((prev) => ({ ...prev, [rowKey]: items }));

      if (expectedMasterId) ensureMasterCount(expectedMasterId);
    } catch (e) {
      console.error("components fetch error:", e);
      setChoices((prev) => ({ ...prev, [rowKey]: [] }));
    }
  };

  /* ---------- Actions (satır) ---------- */
  const addComponentRow = (prefill?: {
    expectedMasterId?: number;
    expectedLabel?: string;
    qty?: number;
  }) => {
    const { key, row } = makeEmptyRow(prefill);
    setComponents((p) => [...p, row]);
    setSearch((s) => ({ ...s, [key]: prefill?.expectedLabel || "" }));
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

        const mode: QtyMode =
          item.qtyMode || (exitMode === "product" ? "quantity" : "unit");

        const m = getMeasure(row);

        return {
          ...item,
          stock: row,
          qtyMode: mode,
          consumeQty:
            mode === "quantity"
              ? (typeof item.consumeQty === "number" ? item.consumeQty : m.max)
              : undefined,
          open: false,
        };
      })
    );

    ensureMasterCount(row.master_id);
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

  /* ---------- Çıkış modu & Tarif seçimi ---------- */
  const handleChangeExitMode = (val: string) => {
    const m = (val as ExitMode) || "component";
    setExitMode(m);
    setRecipeSelect("none");
    setNewRecipeName("");
    resetRows();
    invalidateFinalize();
  };

  const handleChangeRecipeSelect = async (val: string) => {
    setRecipeSelect(val);
    setComponents([]);
    setSearch({});
    setChoices({});
    invalidateFinalize();
    setNewRecipeName("");

    if (!val || val === "none" || val === "new") {
      resetRows();
      return;
    }

    try {
      const { data } = await api.get(`${RECIPES_BASE}/${val}/items`);
      const items: Array<{
        component_master_id: number;
        component_label: string;
        quantity: number;
        unit?: string;
      }> = data?.items || [];

      items.forEach((it) => {
        addComponentRow({
          expectedMasterId: it.component_master_id,
          expectedLabel: it.component_label,
          qty: it.quantity,
        });
      });
    } catch (e) {
      console.error("recipe items fetch error:", e);
    }
  };

  /* ---------- Hedef değişimi (ürün oluşturma) ---------- */
  const handleChangeTarget = (v: string) => {
    const t = String(v || "") as Target;
    setTarget(t);
    if (t !== "stock") {
      setWarehouseId("");
      setLocationId("");
    }
  };

  /* ---------- Dışarı tıkla / ESC ---------- */
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

  /* ---------- Component çıkışı: global hedef/depo/lokasyon ---------- */
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

    const keys = components.map((c) => c.key);
    if (!keys.length) return;

    if (globalRowTarget === "stock") {
      if (!globalWarehouseId || !globalLocationId) return;
      await ensureLocations(globalWarehouseId);
    }

    const keySet = new Set(keys);

    setComponents((prev) =>
      prev.map((c) => {
        if (!keySet.has(c.key)) return c;

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

  /* ---------- Ürün oluştur ---------- */
  const handleSaveProduct = async () => {
    try {
      if (exitMode !== "product") return;

      if (!recipeReady) {
        alert("Önce tarif seçin/kaydedin.");
        return;
      }
      if (!componentsValid) {
        alert("Component seçimleri/alanları geçerli değil.");
        return;
      }
      if (!target) {
        alert("Hedef seçiniz.");
        return;
      }
      if (target === "stock" && (!warehouseId || !locationId)) {
        alert("Depo hedefi için depo ve lokasyon seçiniz.");
        return;
      }
      if (!productName.trim()) {
        alert("Ürün adı zorunlu.");
        return;
      }

      const compPayload = components.map((c) => {
        if (!c.stock) throw new Error("Eksik component seçimi var.");
        const mode: QtyMode = c.qtyMode || "quantity";
        return {
          component_id: c.stock.id,
          mode,
          consume_qty: mode === "quantity" ? Number(c.consumeQty || 0) : undefined,
        };
      });

      const recipe_id =
        recipeSelect === "none" || recipeSelect === "new"
          ? null
          : recipeSelect;

      const product: any = {
        target,
        product_name: productName.trim(),
        recipe_id,
        warehouse_id: target === "stock" ? Number(warehouseId) : undefined,
        location_id: target === "stock" ? Number(locationId) : undefined,
      };

      if (bimeksCode.trim()) product.bimeks_code = bimeksCode.trim();

      const payload = { product, components: compPayload };

      const { data } = await api.post("/products/assemble", payload);
      const newId = data?.product?.id ?? data?.id ?? "?";
      alert(`Ürün oluşturuldu. ID: ${newId}`);

      setShowFinalize(false);
      setTarget("");
      setWarehouseId("");
      setLocationId("");
      resetRows();
      setBimeksCode("");
      setProductName("");
      setRecipeSelect("none");
      setNewRecipeName("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Hata";
      alert(`Kaydetme hatası: ${msg}`);
      console.error("save error", err?.response?.data || err);
    }
  };

  /* ---------- Component çıkışı (çoklu statü değişimi) ---------- */
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
          warehouse_id: t === "stock" && c.rowWarehouseId ? Number(c.rowWarehouseId) : undefined,
          location_id: t === "stock" && c.rowLocationId ? Number(c.rowLocationId) : undefined,
        };
      });

      await api.post("/components/exit", { rows: rowsPayload });

      alert("Component çıkışı kaydedildi.");

      resetRows();
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

  /* ---------- Yeni tarifi kaydet ---------- */
  const handleSaveRecipe = async () => {
    try {
      if (exitMode !== "product") return;
      if (recipeSelect !== "new") return;

      if (!newRecipeName.trim()) {
        alert("Tarif adı zorunlu.");
        return;
      }
      if (!components.length) {
        alert("Tarife eklenecek component yok.");
        return;
      }

      const totals = new Map<number, number>();
      for (const c of components) {
        const sid = c.stock?.master_id;
        if (!sid) continue;
        const add = Number(c.consumeQty || 0);
        const prev = totals.get(sid) || 0;
        totals.set(sid, prev + add);
      }
      if (totals.size === 0) {
        alert("Hiçbir satırda geçerli component seçimi yok.");
        return;
      }

      const items = Array.from(totals.entries()).map(
        ([component_master_id, quantity]) => ({
          component_master_id,
          quantity,
        })
      );

      const payload = {
        recipe_name: newRecipeName.trim(),
        items,
      };

      const { data } = await api.post(RECIPES_BASE, payload);
      const rid = data?.recipe_id || "";

      await loadRecipes();

      if (rid) {
        setRecipeSelect(rid);
      }

      alert(`Tarif kaydedildi${rid ? ` (ID: ${rid})` : ""}.`);
      setNewRecipeName("");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Hata";
      alert(`Tarif kaydetme hatası: ${msg}`);
      console.error("save recipe error", err?.response?.data || err);
    }
  };

  /* ==================================================== */
  return (
    <div className="space-y-6">
      <PageMeta
        title="Stok Çıkışı / Ürün Oluşturma"
        description="Stoktaki kalemlerden çıkış yap veya ürün oluştur"
      />
      <PageBreadcrumb pageTitle="Stok Çıkışı / Ürün Oluşturma" />

      {/* ÇIKIŞ AYARLARI */}
      <ComponentCard title="Çıkış Ayarları">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Çıkış Modu</Label>
            <Select
              options={exitModeOptions}
              value={exitMode}
              onChange={handleChangeExitMode}
              placeholder="Seçiniz"
            />
          </div>

          {exitMode === "product" && (
            <>
              <div className="md:col-span-2">
                <Label>Tarif</Label>
                <Select
                  options={recipeSelectOptions}
                  value={recipeSelect}
                  onChange={handleChangeRecipeSelect}
                  placeholder="Tarif seçiniz"
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Tarifsiz seçerseniz alanları manuel doldurabilirsiniz. Var
                  olan tarif seçildiğinde satırlar beklenen komponent
                  master'ları ve miktarlarıyla gelir.
                </p>
              </div>

              {recipeSelect === "new" && (
                <div className="md:col-span-2">
                  <Label>
                    Yeni Tarif Adı <span className="text-rose-600">*</span>
                  </Label>
                  <Input
                    value={newRecipeName}
                    onChange={(e) => {
                      setNewRecipeName(e.target.value);
                      invalidateFinalize();
                    }}
                    placeholder="Örn. Kırmızı Bant (50mm)"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    Bu isim benzersiz olmalı. Kaydedildiğinde tarif ve içindeki
                    komponentler kayıt altına alınır.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </ComponentCard>

      {/* COMPONENTLER */}
      <ComponentCard title="Componentler">
        {exitMode === "component" && (
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
                      if (locs.length === 1) {
                        setGlobalLocationId(String(locs[0].id));
                      }
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
                    ).map((l) => ({
                      value: String(l.id),
                      label: l.name,
                    })),
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
        )}

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
                const aa = a.master_id === em ? 0 : 1;
                const bb = b.master_id === em ? 0 : 1;
                return aa - bb;
              });

            const rowTarget: RowTarget = c.rowTarget || "sale";

            const whOptions = [
              { value: "", label: "Depo", disabled: true },
              ...warehouses.map((w) => ({
                value: String(w.id),
                label: w.name,
              })),
            ];

            const locOptions = [
              { value: "", label: "Lokasyon", disabled: true },
              ...(c.rowWarehouseId
                ? locationsByWarehouse[Number(c.rowWarehouseId)] || []
                : []
              ).map((l) => ({
                value: String(l.id),
                label: l.name,
              })),
            ];

            return (
              <div
                key={c.key}
                className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4"
              >
                {/* ===================== MOBILE ===================== */}
                <div className="block md:hidden">
                  <div className="mb-3 flex items-center justify-end gap-3">
                    <Button variant="outline" onClick={() => removeRow(c.key)}>
                      Kaldır
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {/* Component */}
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
                            ? `${selected.barcode} — ${selected.name}`
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

                          <div className="max-h-[320px] overflow-auto">
                            <table className="min-w-[800px] w-full text-sm">
                              <thead>
                                <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  <th className="px-3 py-2">Barkod</th>
                                  <th className="px-3 py-2">Tanım</th>
                                  <th className="px-3 py-2">Bimeks Kodu</th>
                                  <th className="px-3 py-2">Ölçü Birimi</th>
                                  <th className="px-3 py-2">Değer</th>
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
                                      className={`cursor-pointer transition ${
                                        selected?.id === r.id
                                          ? "bg-brand-500/5 dark:bg-brand-500/10"
                                          : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                      }`}
                                    >
                                      <td className="px-3 py-2">{r.barcode}</td>
                                      <td className="px-3 py-2">{r.name}</td>
                                      <td className="px-3 py-2">{r.bimeks_code || "—"}</td>
                                      <td className="px-3 py-2">{getStockUnitDisplay(r.stock_unit)}</td>
                                      <td className="px-3 py-2">{getStockValueDisplay(r)}</td>
                                      <td className="px-3 py-2">{r.warehouse.name}</td>
                                      <td className="px-3 py-2">{r.location.name}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-3 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                                      Kayıt bulunamadı
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button variant="outline" onClick={() => toggleDropdown(idx, false)}>
                              Kapat
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Çıkış şekli + Hedef */}
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
                                if (exitMode === "component" && (x.rowTarget || "sale") === "stock") {
                                  return { ...x, qtyMode: "unit", consumeQty: undefined };
                                }
                                if (mode === "unit")
                                  return { ...x, qtyMode: "unit", consumeQty: undefined };
                                const m = getMeasure(x.stock);
                                return { ...x, qtyMode: "quantity", consumeQty: m.max || undefined };
                              })
                            );
                          }}
                          disabled={exitMode === "component" && rowTarget === "stock"}
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

                    {/* Miktar */}
                    <div>
                      {(() => {
                        const mode = c.qtyMode || "unit";
                        const m = getMeasure(selected);
                        const label = mode === "unit" ? "Miktar (Adet)" : `Miktar (${unitLabelTR(selected?.stock_unit)})`;

                        return (
                          <>
                            <Label>{label}</Label>
                            <Input
                              type="number"
                              min="0"
                              max={String(m.max || 0)}
                              value={mode === "quantity" ? (c.consumeQty ?? "") : ""}
                              onChange={(e) => setConsumeQty(c.key, e.target.value)}
                              placeholder={mode === "quantity" && selected ? `0 - ${m.max}` : ""}
                              disabled={mode !== "quantity" || !selected}
                              className="w-full"
                            />
                          </>
                        );
                      })()}
                    </div>

                    {/* Depo + Lokasyon */}
                    {exitMode === "component" && (
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
                    )}

                    {/* Stok özeti */}
                    {selected && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {(() => {
                          const mode: QtyMode = c.qtyMode || "unit";
                          const masterId = selected.master_id;
                          const usedBeforeUnits = components
                            .slice(0, idx)
                            .filter((x) => x.stock?.master_id === masterId && (x.qtyMode || "unit") === "unit").length;

                          if (mode === "unit") {
                            const total = masterCounts[masterId];
                            const hasTotal = typeof total === "number";
                            const after = hasTotal ? Math.max(0, total - usedBeforeUnits - 1) : null;

                            return (
                              <>
                                Depoda: <span className={toneClass(Number(total ?? NaN), true)}>{hasTotal ? total : "…"}</span> • 
                                Sonrası: {after !== null ? <span className={toneClass(after, true)}>{after}</span> : "—"}
                              </>
                            );
                          }

                          const m = getMeasure(selected);
                          const used = Number(c.consumeQty || 0);
                          const after = Math.max(0, (m.max || 0) - used);

                          return (
                            <>
                              Mevcut: <span className={toneClass(m.max, true)}>{m.max}</span> • 
                              Sonrası: <span className={toneClass(after, true)}>{after}</span>
                            </>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                </div>

                {/* ===================== DESKTOP ===================== */}
                {exitMode === "component" ? (
                  /* COMPONENT MODU: 2 Satır Grid (Stok Girişi gibi) */
                  <div className="hidden md:block">
                    <div className="space-y-2">
                    {/* SATIR 1: Component | Hedef | Ölçü Birimi | Miktar */}
                    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-3 items-center">
                      {/* Component seçici */}
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
                              ? `${selected.barcode} — ${selected.name}`
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

                            <div className="max-h-[320px] overflow-auto">
                              <table className="min-w-[800px] w-full text-sm">
                                <thead>
                                  <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                    <th className="px-3 py-2">Barkod</th>
                                    <th className="px-3 py-2">Tanım</th>
                                    <th className="px-3 py-2">Bimeks Kodu</th>
                                    <th className="px-3 py-2">Ölçü Birimi</th>
                                    <th className="px-3 py-2">Değer</th>
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
                                        className={`cursor-pointer transition ${
                                          selected?.id === r.id
                                            ? "bg-brand-500/5 dark:bg-brand-500/10"
                                            : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                        }`}
                                      >
                                        <td className="px-3 py-2">{r.barcode}</td>
                                        <td className="px-3 py-2">{r.name}</td>
                                        <td className="px-3 py-2">{r.bimeks_code || "—"}</td>
                                        <td className="px-3 py-2">{getStockUnitDisplay(r.stock_unit)}</td>
                                        <td className="px-3 py-2">{getStockValueDisplay(r)}</td>
                                        <td className="px-3 py-2">{r.warehouse.name}</td>
                                        <td className="px-3 py-2">{r.location.name}</td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td className="px-3 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                                        Kayıt bulunamadı
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <Button variant="outline" onClick={() => toggleDropdown(idx, false)}>
                                Kapat
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Hedef */}
                      <Select
                        options={[
                          { value: "sale", label: "Satış" },
                          { value: "stock", label: "Depo" },
                        ]}
                        value={rowTarget}
                        onChange={(v: string) => setRowTarget(c.key, v as RowTarget)}
                        placeholder="Hedef"
                      />

                      {/* Ölçü Birimi (Çıkış Şekli) */}
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
                              if (exitMode === "component" && (x.rowTarget || "sale") === "stock") {
                                return { ...x, qtyMode: "unit", consumeQty: undefined };
                              }
                              if (mode === "unit")
                                return { ...x, qtyMode: "unit", consumeQty: undefined };
                              const m = getMeasure(x.stock);
                              return { ...x, qtyMode: "quantity", consumeQty: m.max || undefined };
                            })
                          );
                        }}
                        disabled={exitMode === "component" && rowTarget === "stock"}
                        placeholder="Ölçü Birimi"
                      />

                      {/* Miktar */}
                      {(() => {
                        const mode = c.qtyMode || "unit";
                        const m = getMeasure(selected);

                        return (
                          <Input
                            type="number"
                            min="0"
                            max={String(m.max || 0)}
                            value={mode === "quantity" ? (c.consumeQty ?? "") : ""}
                            onChange={(e) => setConsumeQty(c.key, e.target.value)}
                            placeholder={mode === "unit" ? "Adet" : mode === "quantity" && selected ? unitLabelTR(selected?.stock_unit) : "Miktar"}
                            disabled={mode !== "quantity" || !selected}
                          />
                        );
                      })()}
                    </div>

                    {/* SATIR 2: Stok özeti | Depo | Lokasyon | Kaldır */}
                    <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr] gap-3 items-center">
                      {/* Stok özeti */}
                      <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {selected ? (
                          (() => {
                            const mode: QtyMode = c.qtyMode || "unit";
                            const masterId = selected.master_id;
                            const usedBeforeUnits = components
                              .slice(0, idx)
                              .filter((x) => x.stock?.master_id === masterId && (x.qtyMode || "unit") === "unit").length;

                            if (mode === "unit") {
                              const total = masterCounts[masterId];
                              const hasTotal = typeof total === "number";
                              const after = hasTotal ? Math.max(0, total - usedBeforeUnits - 1) : null;

                              return (
                                <>
                                  Depoda: <span className={toneClass(Number(total ?? NaN), true)}>{hasTotal ? total : "…"}</span> • 
                                  Sonrası: {after !== null ? <span className={toneClass(after, true)}>{after}</span> : "—"}
                                </>
                              );
                            }

                            const m = getMeasure(selected);
                            const used = Number(c.consumeQty || 0);
                            const after = Math.max(0, (m.max || 0) - used);

                            return (
                              <>
                                Mevcut: <span className={toneClass(m.max, true)}>{m.max}</span> • 
                                Sonrası: <span className={toneClass(after, true)}>{after}</span>
                              </>
                            );
                          })()
                        ) : c.expectedLabel ? (
                          `Beklenen: ${c.expectedLabel}`
                        ) : (
                          "—"
                        )}
                      </div>

                      {/* Depo (component modunda) */}
                      {exitMode === "component" ? (
                        <Select
                          options={whOptions}
                          value={c.rowWarehouseId || ""}
                          onChange={(v: string) => setRowWarehouse(c.key, v)}
                          placeholder="Depo"
                          disabled={rowTarget !== "stock"}
                        />
                      ) : <div />}

                      {/* Lokasyon (component modunda) */}
                      {exitMode === "component" ? (
                        <Select
                          options={locOptions}
                          value={c.rowLocationId || ""}
                          onChange={(v: string) => setRowLocation(c.key, v)}
                          placeholder="Lokasyon"
                          disabled={rowTarget !== "stock" || !c.rowWarehouseId}
                        />
                      ) : <div />}

                      {/* Kaldır butonu */}
                      <Button
                        variant="outline"
                        onClick={() => removeRow(c.key)}
                      >
                        Kaldır
                      </Button>
                    </div>
                  </div>
                </div>
                ) : (
                  /* ÜRÜN OLUŞTURMA MODU: Basit Tek Satır */
                  <div className="hidden md:grid md:grid-cols-[2fr_1fr_1fr_auto] gap-3 items-center">
                    {/* Component seçici */}
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
                            ? `${selected.barcode} — ${selected.name}`
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

                          <div className="max-h-[320px] overflow-auto">
                            <table className="min-w-[800px] w-full text-sm">
                              <thead>
                                <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                  <th className="px-3 py-2">Barkod</th>
                                  <th className="px-3 py-2">Tanım</th>
                                  <th className="px-3 py-2">Bimeks Kodu</th>
                                  <th className="px-3 py-2">Ölçü Birimi</th>
                                  <th className="px-3 py-2">Değer</th>
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
                                      className={`cursor-pointer transition ${
                                        selected?.id === r.id
                                          ? "bg-brand-500/5 dark:bg-brand-500/10"
                                          : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                      }`}
                                    >
                                      <td className="px-3 py-2">{r.barcode}</td>
                                      <td className="px-3 py-2">{r.name}</td>
                                      <td className="px-3 py-2">{r.bimeks_code || "—"}</td>
                                      <td className="px-3 py-2">{getStockUnitDisplay(r.stock_unit)}</td>
                                      <td className="px-3 py-2">{getStockValueDisplay(r)}</td>
                                      <td className="px-3 py-2">{r.warehouse.name}</td>
                                      <td className="px-3 py-2">{r.location.name}</td>
                                    </tr>
                                  ))
                                ) : (
                                  <tr>
                                    <td className="px-3 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                                      Kayıt bulunamadı
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-3 flex justify-end">
                            <Button variant="outline" onClick={() => toggleDropdown(idx, false)}>
                              Kapat
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Ölçü Birimi */}
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
                            if (mode === "unit")
                              return { ...x, qtyMode: "unit", consumeQty: undefined };
                            const m = getMeasure(x.stock);
                            return { ...x, qtyMode: "quantity", consumeQty: m.max || undefined };
                          })
                        );
                      }}
                      placeholder="Ölçü Birimi"
                    />

                    {/* Miktar */}
                    {(() => {
                      const mode = c.qtyMode || "unit";
                      const m = getMeasure(selected);

                      return (
                        <Input
                          type="number"
                          min="0"
                          max={String(m.max || 0)}
                          value={mode === "quantity" ? (c.consumeQty ?? "") : ""}
                          onChange={(e) => setConsumeQty(c.key, e.target.value)}
                          placeholder={mode === "unit" ? "Adet" : mode === "quantity" && selected ? unitLabelTR(selected?.stock_unit) : "Miktar"}
                          disabled={mode !== "quantity" || !selected}
                        />
                      );
                    })()}

                    {/* Kaldır butonu */}
                    <Button
                      variant="outline"
                      className="h-10 w-10 p-0"
                      onClick={() => removeRow(c.key)}
                    >
                      <span aria-hidden>-</span>
                    </Button>
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 flex gap-2">
            <Button variant="primary" onClick={() => addComponentRow()}>
              Component Ekle
            </Button>
          </div>
        </div>

        {exitMode === "product" && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            {recipeSelect === "new" && (
              <Button
                variant="primary"
                onClick={handleSaveRecipe}
                disabled={!newRecipeName.trim() || components.length === 0}
              >
                Tarifi Kaydet
              </Button>
            )}

            <Button
              variant="outline"
              onClick={() => setShowFinalize(true)}
              disabled={
                !recipeReady || components.length === 0 || !componentsValid
              }
            >
              Devam Et
            </Button>

            {!recipeReady && (
              <span className="text-xs text-amber-600">
                Önce tarif seçin / kaydedin.
              </span>
            )}
            {components.length > 0 && !componentsValid && (
              <span className="text-xs text-amber-600">
                Kullanılacak alanlar geçerli olmalı.
              </span>
            )}
          </div>
        )}

        {exitMode === "component" && (
          <div className="mt-6 flex items-center justify-end">
            <Button
              variant="primary"
              disabled={!componentExitValid}
              onClick={handleSaveComponentExit}
            >
              Kaydet
            </Button>
          </div>
        )}
      </ComponentCard>

      {/* HEDEF (ürün oluşturma) */}
      {showFinalize && exitMode === "product" && (
        <ComponentCard title="Hedef">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label>Hedef</Label>
              <Select
                options={targetOptions}
                value={target}
                onChange={handleChangeTarget}
                placeholder="Seçiniz"
              />
            </div>

            <div>
              <Label>
                Ürün Adı <span className="text-rose-600">*</span>
              </Label>
              <Input
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="Örn: Kırmızı Bant 50mm"
              />
            </div>

            <div>
              <Label>Bimeks Kodu</Label>
              <Input
                value={bimeksCode}
                onChange={(e) => setBimeksCode(e.target.value)}
                placeholder="Örn: BMK0001"
              />
            </div>

            {target === "stock" && (
              <>
                <div>
                  <Label>Depo</Label>
                  <Select
                    options={[
                      { value: "", label: "Seçiniz", disabled: true },
                      ...warehouses.map((w) => ({
                        value: String(w.id),
                        label: w.name,
                      })),
                    ]}
                    value={warehouseId}
                    onChange={async (v: string) => {
                      setWarehouseId(v);
                      setLocationId("");
                      await ensureLocations(v);
                    }}
                    placeholder="Seçiniz"
                  />
                </div>

                <div>
                  <Label>Lokasyon</Label>
                  <Select
                    options={[
                      { value: "", label: "Seçiniz", disabled: true },
                      ...(warehouseId
                        ? locationsByWarehouse[Number(warehouseId)] || []
                        : []
                      ).map((l) => ({
                        value: String(l.id),
                        label: l.name,
                      })),
                    ]}
                    value={locationId}
                    onChange={(v: string) => setLocationId(v)}
                    placeholder="Seçiniz"
                  />
                </div>
              </>
            )}
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setShowFinalize(false)}>
              Geri
            </Button>
            <Button
              variant="primary"
              disabled={!productFinalizeValid}
              onClick={handleSaveProduct}
            >
              Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}
    </div>
  );
}