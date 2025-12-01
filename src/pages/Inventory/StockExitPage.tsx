// src/pages/Product/ProductAssemble.tsx
import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import api from "../../services/api";

/* -------------------- Config -------------------- */
const RECIPES_BASE = "/products/recipes";

/* -------------------- Types -------------------- */
type Target = "production" | "screenprint" | "stock";
type ExitMode = "component" | "product";
type RowTarget = "sale" | "stock";

type RecipeRow = {
  recipe_id: string;
  recipe_name: string;
  label: string;
};

type StockRow = {
  id: number;
  barcode: string;
  name: string | null;
  area: number; // satırın alanı
  areaUnit: string;
  warehouse: { id: number; name: string };
  location: { id: number; name: string };
  master_id: number;
};

type PickedComponent = {
  key: string;
  stock?: StockRow;
  consumeQty?: number; // Kullanılacak alan
  open?: boolean;

  expectedMasterId?: number;
  expectedLabel?: string;

  rowTarget?: RowTarget;
  rowWarehouseId?: string;
  rowLocationId?: string;
};

type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };

const safeRandomId = () =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  "id_" + Math.random().toString(36).slice(2, 10);

const ROW_GRID_COMPONENT =
  "grid gap-3 md:grid-cols-[minmax(28px,0.1fr)_minmax(260px,1.6fr)_minmax(120px,0.6fr)_minmax(150px,0.6fr)_minmax(150px,0.8fr)_minmax(150px,0.8fr)_minmax(80px,0.4fr)]";

const ROW_GRID_PRODUCT =
  "grid gap-3 md:grid-cols-[minmax(28px,0.1fr)_minmax(260px,1.8fr)_minmax(120px,0.7fr)_minmax(80px,0.4fr)]";

/* ==================================================== */

export default function StockExitPage() {
  /* ---------- ÇIKIŞ MODU ---------- */
  const [exitMode, setExitMode] = useState<ExitMode>("component");

  /* ---------- ÜRÜN BİLGİSİ ---------- */
  const [productName, setProductName] = useState<string>("");

  /* ---------- Tarif listesi & seçim ---------- */
  const [recipes, setRecipes] = useState<RecipeRow[]>([]);
  const [recipeSelect, setRecipeSelect] = useState<string>("none"); // "none" | "new" | recipe_id
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

  /* ---------- Components ---------- */
  const [components, setComponents] = useState<PickedComponent[]>([]);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, StockRow[]>>({});

  // Satır seçimleri
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);

  const allSelected =
    components.length > 0 && selectedRowKeys.length === components.length;

  const toggleAllRows = () => {
    if (allSelected) setSelectedRowKeys([]);
    else setSelectedRowKeys(components.map((c) => c.key));
  };

  const toggleRowSelection = (key: string) => {
    setSelectedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

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

  /* ---------- Yardımcılar ---------- */
  const toneClass = (n: number, zeroIsRed = false) => {
    if (!Number.isFinite(n)) return "";
    if (zeroIsRed && n === 0) return "text-rose-600";
    if (n > 5) return "text-emerald-600";
    if (n >= 1) return "text-amber-600";
    return "";
  };

  /* ---------- FE: master bazında toplam stok (cache) ---------- */
  const [masterTotals, setMasterTotals] = useState<Record<number, number>>({});

  const ensureMasterTotal = async (masterId?: number) => {
    if (!masterId) return;
    if (masterTotals[masterId] !== undefined) return; // cache
    try {
      const { data } = await api.get("/components", {
        params: { availableOnly: true, masterId },
      });
      const total = (data || []).reduce(
        (sum: number, r: any) => sum + Number(r.area ?? 0),
        0
      );
      setMasterTotals((m) => ({ ...m, [masterId]: total }));
    } catch {
      setMasterTotals((m) => ({ ...m, [masterId]: 0 }));
    }
  };

  /* ---------- Validasyon ---------- */
  const componentsValid =
    components.length > 0 &&
    components.every((c) => {
      if (!c.stock) return false;
      const q = Number(c.consumeQty || 0);
      return q > 0 && q <= (c.stock.area ?? 0);
    });

  const recipeReady = useMemo(() => {
    if (exitMode !== "product") return true;
    if (recipeSelect === "new") return !!newRecipeName.trim();
    // "none" veya herhangi bir tarif ID'si kabul
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

  /* ---------- finalize’ı sıfırlayan yardımcı ---------- */
  const invalidateFinalize = () => {
    if (showFinalize) setShowFinalize(false);
    setTarget("");
    setWarehouseId("");
    setLocationId("");
    setBimeksCode("");
    setProductName("");
  };

  const resetRows = () => {
    setComponents([]);
    setSearch({});
    setChoices({});
    setSelectedRowKeys([]);
  };

  /* ---------- API: picker ---------- */
  const loadChoices = async (
    rowKey: string,
    q: string,
    expectedMasterId?: number
  ) => {
    try {
      const params: any = { search: q || undefined, availableOnly: true };
      if (expectedMasterId) params.masterId = expectedMasterId;

      const res = await api.get("/components", { params });
      const items: StockRow[] = (res.data || []).map((r: any) => {
        const lengthUnit =
          r.master?.length_unit || r.master_length_unit || "";
        const areaUnit =
          lengthUnit === "um"
            ? "um²"
            : lengthUnit === "m"
            ? "m²"
            : lengthUnit
            ? `${lengthUnit}²`
            : "";

        return {
          id: r.id,
          barcode: r.barcode,
          area: Number(r.area ?? 0),
          areaUnit,
          name:
            r.master?.bimeks_product_name ||
            r.master_bimeks_product_name ||
            r.bimeks_product_name ||
            null,
          warehouse: r.warehouse || { id: 0, name: "-" },
          location: r.location || { id: 0, name: "-" },
          master_id: r.master?.id ?? r.master_id,
        };
      });

      setChoices((prev) => ({ ...prev, [rowKey]: items }));

      if (expectedMasterId) ensureMasterTotal(expectedMasterId);
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
    const key = safeRandomId();
    setComponents((p) => [
      ...p,
      {
        key,
        open: false,
        expectedMasterId: prefill?.expectedMasterId,
        expectedLabel: prefill?.expectedLabel,
        consumeQty: prefill?.qty,
        rowTarget: "sale",
        rowWarehouseId: "",
        rowLocationId: "",
      },
    ]);
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
      prev.map((c, i) =>
        i === idx
          ? {
              ...c,
              stock: row,
              consumeQty:
                typeof c.consumeQty === "number" ? c.consumeQty : row.area,
              open: false,
            }
          : c
      )
    );
    ensureMasterTotal(row.master_id);
  };

  const removeRow = (key: string) => {
    setComponents((prev) => prev.filter((c) => c.key !== key));
    setSearch((s) => {
      const n = { ...s };
      delete n[key];
      return n;
    });
    setChoices((p) => {
      const n = { ...p } as any;
      delete n[key];
      return n;
    });
    setSelectedRowKeys((prev) => prev.filter((k) => k !== key));
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
      prev.map((c) =>
        c.key === key
          ? {
              ...c,
              rowTarget: val,
              ...(val === "sale"
                ? { rowWarehouseId: "", rowLocationId: "" }
                : {}),
            }
          : c
      )
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
    resetRows();
    invalidateFinalize();
    setNewRecipeName("");

    if (!val || val === "none" || val === "new") return;

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
  const handleChangeGlobalTarget = (v: string) => {
  const val = (v || "") as RowTarget | "";
    setGlobalRowTarget(val);

    // Satış seçildiyse global depo & lokasyon temizlensin
    if (val === "sale") {
      setGlobalWarehouseId("");
      setGlobalLocationId("");
    }
  };
  const [globalWarehouseId, setGlobalWarehouseId] = useState<string>("");
  const [globalLocationId, setGlobalLocationId] = useState<string>("");

  const applyGlobalToRows = async (scope: "selected" | "all") => {
    if (!globalRowTarget) return;

    const keys =
      scope === "all"
        ? components.map((c) => c.key)
        : selectedRowKeys.slice();
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

        // globalRowTarget === "stock"
        return {
          ...c,
          rowTarget: "stock",
          rowWarehouseId: globalWarehouseId,
          rowLocationId: globalLocationId,
        };
      })
    );
  };

  const canApplySelected =
    !!globalRowTarget &&
    selectedRowKeys.length > 0 &&
    (globalRowTarget === "sale" ||
      (globalRowTarget === "stock" &&
        !!globalWarehouseId &&
        !!globalLocationId));

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
        return {
          component_id: c.stock.id,
          // her zaman alan bazlı
          consume_qty: Number(c.consumeQty || 0),
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

      // reset
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
        return {
          component_id: c.stock.id,
          consume_qty: Number(c.consumeQty || 0),
          target: t, // "sale" | "stock"
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

      await api.post("/components/exit", { rows: rowsPayload });

      alert("Component çıkışı kaydedildi.");

      // FE tarafını temizle
      resetRows();
      setGlobalRowTarget("");
      setGlobalWarehouseId("");
      setGlobalLocationId("");
      setMasterTotals({});
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
    <div className="space-y-6 overflow-x-hidden">
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
                  master’ları ve miktarlarıyla gelir.
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
        {/* Global hedef / depo / lokasyon sadece component çıkışında */}
        {exitMode === "component" && (
          <div className="mb-4 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(160px,0.8fr)_minmax(220px,1fr)_minmax(220px,1fr)_auto_auto]">
              <div>
                <Label>Global Hedef</Label>
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
                    // sadece hedef Depo iken anlamlı
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
                  disabled={globalRowTarget !== "stock"}   // 🔴 Satışta kilit
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
                  disabled={globalRowTarget !== "stock"}   // 🔴 Satışta kilit
                />
              </div>
              <div className="flex items-end justify-end md:justify-start gap-2">
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => applyGlobalToRows("selected")}
                  disabled={!canApplySelected}
                >
                  Seçilene Uygula
                </Button>
              </div>
              <div className="flex items-end justify-end md:justify-start gap-2">
                <Button
                  variant="outline"
                  className="w-full md:w-auto"
                  onClick={() => applyGlobalToRows("all")}
                  disabled={!canApplyAll}
                >
                  Tümüne Uygula
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Checkbox checked={allSelected} onChange={toggleAllRows} />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Tümünü Seç
              </span>
              <span className="ml-auto text-xs text-gray-500">
                Seçili: {selectedRowKeys.length}
              </span>
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
            const unitLabel = selected?.areaUnit || "alan";

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

            const isSelected = selectedRowKeys.includes(c.key);

            return (
              <div
                key={c.key}
                className={exitMode === "component" ? ROW_GRID_COMPONENT : ROW_GRID_PRODUCT}
              >
                {/* Checkbox */}
                <div className="flex items-center pt-6 md:pt-7">
                  {exitMode === "component" && (
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleRowSelection(c.key)}
                    />
                  )}
                </div>

                {/* Component seçimi */}
                <div data-comp-picker>
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
                        ? `Beklenen: ${c.expectedLabel} (seçiniz)`
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
                              <th className="px-3 py-2">Alan</th>
                              <th className="px-3 py-2">Birim</th>
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
                                  <td className="px-3 py-2">{r.area}</td>
                                  <td className="px-3 py-2">{r.areaUnit}</td>
                                  <td className="px-3 py-2">
                                    {r.warehouse.name}
                                  </td>
                                  <td className="px-3 py-2">
                                    {r.location.name}
                                  </td>
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

                  {selected && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {(() => {
                        const totalRaw = masterTotals[selected.master_id]; // master bazında toplam alan
                        const hasTotal = typeof totalRaw === "number";

                        const usedBefore = components
                          .slice(0, idx)
                          .filter(
                            (x) => x.stock?.master_id === selected.master_id
                          )
                          .reduce((sum, x) => {
                            const u = Number(x.consumeQty || 0);
                            return sum + (Number.isFinite(u) && u > 0 ? u : 0);
                          }, 0);

                        const usedCurrent =
                          Number.isFinite(Number(c.consumeQty)) &&
                          Number(c.consumeQty) > 0
                            ? Number(c.consumeQty)
                            : null;

                        const totalAdj = hasTotal
                          ? Math.max(0, totalRaw - usedBefore)
                          : null;
                        const remaining =
                          totalAdj !== null && usedCurrent !== null
                            ? Math.max(0, totalAdj - usedCurrent)
                            : null;

                        const unit = selected.areaUnit;

                        return (
                          <>
                            <span>
                              Toplam Alan:{" "}
                              <span
                                className={toneClass(
                                  Number(totalAdj ?? NaN),
                                  true
                                )}
                              >
                                {totalAdj !== null ? totalAdj : "…"}
                              </span>{" "}
                              {unit}
                            </span>
                            {"  •  "}
                            <span>
                              {selected.warehouse.name} /{" "}
                              {selected.location.name}
                            </span>
                            {"  •  "}
                            <span>
                              Kullanım sonrası kalan{" "}
                              {remaining !== null ? (
                                <>
                                  <span className={toneClass(remaining, true)}>
                                    {remaining}
                                  </span>{" "}
                                  {unit}
                                </>
                              ) : (
                                "—"
                              )}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  )}

                  {!selected && c.expectedLabel && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Beklenen: {c.expectedLabel}
                    </div>
                  )}
                </div>

                {/* Miktar (yanında birim) */}
                <div>
                  <Label>{`Miktar (${unitLabel})`}</Label>
                  <Input
                    type="number"
                    min="0"
                    max={String(selected?.area ?? 0)}
                    value={c.consumeQty ?? ""}
                    onChange={(e) => setConsumeQty(c.key, e.target.value)}
                    className="w-full md:max-w-[140px]"
                    placeholder={
                      selected
                        ? `0 - ${selected.area}`
                        : c.expectedLabel
                        ? `Öneri: ${c.consumeQty ?? ""}`
                        : ""
                    }
                    disabled={!selected && !c.expectedMasterId}
                  />
                </div>

                {/* Hedef / Depo / Lokasyon sadece component modunda */}
                {exitMode === "component" && (
                  <>
                    {/* Hedef */}
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

                    {/* Depo */}
                    <div>
                      {rowTarget === "stock" && (
                        <>
                          <Label>Depo</Label>
                          <Select
                            options={whOptions}
                            value={c.rowWarehouseId || ""}
                            onChange={(v: string) => setRowWarehouse(c.key, v)}
                            placeholder="Depo"
                          />
                        </>
                      )}
                    </div>

                    {/* Lokasyon */}
                    <div>
                      {rowTarget === "stock" && (
                        <>
                          <Label>Lokasyon</Label>
                          <Select
                            options={locOptions}
                            value={c.rowLocationId || ""}
                            onChange={(v: string) => setRowLocation(c.key, v)}
                            placeholder="Lokasyon"
                          />
                        </>
                      )}
                    </div>
                  </>
                )}

                {/* Aksiyon sütunu (Kaldır) */}
                <div className="md:justify-self-end">
                  <Label className="invisible">Aksiyon</Label>
                  <div className="h-11 flex items-center">
                    <Button variant="outline" onClick={() => removeRow(c.key)}>
                      Kaldır
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          <div className="pt-2 flex gap-2">
            <Button variant="primary" onClick={() => addComponentRow()}>
              Component Ekle
            </Button>
          </div>
        </div>

        {/* ALT BUTONLAR */}
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
