import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import api from "../../services/api";

/* -------------------- Types -------------------- */
type Target = "production" | "screenprint" | "stock";
type RecipeMode = "none" | "existing" | "new";

type StockRow = {
  id: number;
  barcode: string;
  name: string | null;
  unit: "EA" | "M" | "KG" | string;
  quantity: number;
  warehouse: { id: number; name: string };
  location: { id: number; name: string };
  master_id: number;
};

type PickedComponent = {
  key: string;
  stock?: StockRow;
  consumeQty?: number;
  open?: boolean;

  expectedMasterId?: number;
  expectedLabel?: string;
};

type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };

const safeRandomId = () =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  "id_" + Math.random().toString(36).slice(2, 10);

/* ==================================================== */

export default function ProductAssemble() {
  /* ---------- PRODUCT/BANT kimlikleri ---------- */
  const [productCategoryId, setProductCategoryId] = useState<number | null>(null);
  const [bantTypeId, setBantTypeId] = useState<number | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const cats = await api.get("/lookups/categories");
        const productCat = (cats.data || []).find((c: any) => c.name === "PRODUCT");
        if (productCat?.id) {
          setProductCategoryId(productCat.id);
          const types = await api.get(`/lookups/types/${productCat.id}`);
          const bant = (types.data || []).find((t: any) => t.name === "BANT");
          if (bant?.id) setBantTypeId(bant.id);
        }
      } catch (e) {
        console.error("PRODUCT/BANT id yüklenemedi:", e);
      }
    })();
  }, []);

  /* ---------- Tarif listesi & seçim ---------- */
  const [recipeMode, setRecipeMode] = useState<RecipeMode>("new");
  const [recipes, setRecipes] = useState<{ recipe_id: string; label: string; master_id: number }[]>([]);
  const [recipeId, setRecipeId] = useState<string>(""); // existing selection
  const [selectedRecipeMasterId, setSelectedRecipeMasterId] = useState<number | null>(null);

  const [newRecipeName, setNewRecipeName] = useState<string>("");

  const loadRecipes = async () => {
    if (!productCategoryId || !bantTypeId) return;
    try {
      const { data } = await api.get("/recipes", {
        params: { categoryId: productCategoryId, typeId: bantTypeId },
      });
      const rows = (data || []).map((r: any) => ({
        recipe_id: r.recipe_id,
        label: r.recipe_name || r.display_label || r.recipe_id,
        master_id: r.master_id,
      }));
      setRecipes(rows);
    } catch (e) {
      console.error("recipes fetch error:", e);
      setRecipes([]);
    }
  };
  useEffect(() => { loadRecipes(); /* eslint-disable-next-line */ }, [productCategoryId, bantTypeId]);

  /* ---------- Components ---------- */
  const [components, setComponents] = useState<PickedComponent[]>([]);
  const [search, setSearch] = useState<Record<string, string>>({});
  const [choices, setChoices] = useState<Record<string, StockRow[]>>({});

  /* ---------- Finalize ---------- */
  const [showFinalize, setShowFinalize] = useState(false);
  const [newBarcode, setNewBarcode] = useState("");
  const [target, setTarget] = useState<Target | "">("");

  // Depo/Lokasyon (hedef=Depo)
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});
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
    if (!id) return;
    if (locationsByWarehouse[id]) return;
    try {
      const { data } = await api.get(`/lookups/locations?warehouseId=${id}`);
      setLocationsByWarehouse((prev) => ({ ...prev, [id]: data || [] }));
    } catch (e) {
      console.error("locations error:", e);
    }
  };

  const selectedIds = useMemo(
    () => components.map(c => c.stock?.id).filter(Boolean) as number[],
    [components]
  );

  /* ---------- Options ---------- */
  const targetOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true },
      { value: "production", label: "Üretim" },
      { value: "screenprint", label: "Serigrafi" },
      { value: "stock", label: "Depo" },
    ],
    []
  );

  const recipeModeOptions = useMemo(() => ([
    { value: "none",     label: "Tarifsiz (manuel)" },
    { value: "existing", label: "Var olan tarifi kullan" },
    { value: "new",      label: "Yeni tarif oluştur" },
  ]), []);

  const recipeSelectOptions = useMemo(() => ([
    { value: "", label: "Tarif seçiniz", disabled: true },
    ...recipes.map(r => ({ value: r.recipe_id, label: r.label }))
  ]), [recipes]);

  /* ---------- Helpers ---------- */
  const componentsValid =
    components.length > 0 &&
    components.every((c) => {
      if (!c.stock) return false;
      if (c.stock.unit === "EA") return true;
      const q = Number(c.consumeQty || 0);
      return q > 0 && q <= (c.stock?.quantity ?? 0);
    });

  const recipeReady = useMemo(() => {
    if (recipeMode === "existing") return !!recipeId && !!selectedRecipeMasterId;
    if (recipeMode === "new")      return !!newRecipeName.trim() || !!selectedRecipeMasterId; // kaydetmeden önce ad var, kaydettikten sonra master id var
    return true; // none
  }, [recipeMode, recipeId, selectedRecipeMasterId, newRecipeName]);

  const finalizeValid =
    recipeReady &&
    componentsValid &&
    newBarcode.trim().length > 0 &&
    !!target &&
    (target !== "stock" || (warehouseId && locationId));

  /* ---------- finalize’ı sıfırlayan yardımcı ---------- */
  const invalidateFinalize = () => {
    if (showFinalize) setShowFinalize(false);
    setNewBarcode("");
    setTarget("");
    setWarehouseId("");
    setLocationId("");
  };

  /* ---------- API: picker ---------- */
  const loadChoices = async (rowKey: string, q: string, expectedMasterId?: number) => {
    try {
      const params: any = { search: q || undefined, availableOnly: true };
      if (expectedMasterId) params.masterId = expectedMasterId;

      const res = await api.get("/components", { params });
      const items: StockRow[] = (res.data || []).map((r: any) => ({
        id: r.id,
        barcode: r.barcode,
        unit: r.unit,
        quantity: r.quantity,
        name: r.master?.display_label || r.master?.name || r.master_name || r.name || null,
        warehouse: r.warehouse || { id: 0, name: "-" },
        location:  r.location  || { id: 0, name: "-" },
        master_id: r.master?.id ?? r.master_id,
      }));
      setChoices((prev) => ({ ...prev, [rowKey]: items }));
    } catch (e) {
      console.error("components fetch error:", e);
      setChoices((prev) => ({ ...prev, [rowKey]: [] }));
    }
  };

  /* ---------- Actions (satır) ---------- */
  const addComponentRow = (prefill?: { expectedMasterId?: number; expectedLabel?: string; qty?: number }) => {
    const key = safeRandomId();
    setComponents((p) => [
      ...p,
      {
        key,
        open: false,
        expectedMasterId: prefill?.expectedMasterId,
        expectedLabel: prefill?.expectedLabel,
        consumeQty: prefill?.qty,
      },
    ]);
    setSearch((s) => ({ ...s, [key]: prefill?.expectedLabel || "" }));
  };

  const toggleDropdown = (idx: number, open?: boolean) => {
    setComponents((prev) =>
      prev.map((c, i) => (i === idx ? { ...c, open: open ?? !c.open } : { ...c, open: false }))
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
              consumeQty: row.unit === "EA" ? undefined : (c.consumeQty ?? undefined),
              open: false,
            }
          : c
      )
    );
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
  };

  const setConsumeQty = (key: string, val: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.key !== key ? c : { ...c, consumeQty: c.stock?.unit === "EA" ? undefined : Math.max(0, Number(val || 0)) }
      )
    );
  };

  /* ---------- Tarif modu & seçimleri ---------- */
  const handleChangeRecipeMode = (val: string) => {
    const m = val as RecipeMode;
    setRecipeMode(m);
    setRecipeId("");
    setSelectedRecipeMasterId(null);
    setNewRecipeName("");
    setComponents([]);
    setSearch({});
    setChoices({});
    invalidateFinalize(); // tarif değişti -> finalize kapat
  };

  const handleSelectRecipe = async (rid: string) => {
    setRecipeId(rid);
    setSelectedRecipeMasterId(null);
    setComponents([]);
    setSearch({});
    setChoices({});
    invalidateFinalize();

    if (!rid) return;

    try {
      // listedeki master_id’yi bul
      const meta = recipes.find(r => r.recipe_id === rid);
      if (meta?.master_id) setSelectedRecipeMasterId(meta.master_id);

      const { data } = await api.get(`/recipes/${rid}/items`);
      const items: Array<{ component_master_id: number; component_label: string; quantity: number, unit?: string }> =
        data?.items || [];

      items.forEach(it => {
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

  /* ---------- Hedef değişimi ---------- */
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
      if (!inside) setComponents((prev) => prev.map((c) => ({ ...c, open: false })));
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setComponents((prev) => prev.map((c) => ({ ...c, open: false })));
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  /* ---------- Ürün oluştur ---------- */
  const handleSaveProduct = async () => {
    try {
      if (!recipeReady) { alert("Önce tarif seçin/kaydedin."); return; }
      if (!componentsValid) { alert("Component seçimleri/miktarları geçerli değil."); return; }
      if (!newBarcode.trim()) { alert("Barkod zorunlu."); return; }
      if (!target) { alert("Hedef seçiniz."); return; }
      if (target === "stock" && (!warehouseId || !locationId)) {
        alert("Depo hedefi için depo ve lokasyon seçiniz."); return;
      }
      const master_id = selectedRecipeMasterId; // ürün master’ı tarif master’ı

      if (!master_id) { alert("Seçili tarifin master bilgisi bulunamadı."); return; }

      const compPayload = components.map(c => {
        if (!c.stock) throw new Error("Eksik component seçimi var.");
        return {
          component_id: c.stock.id,
          unit: c.stock.unit,
          consume_qty: c.stock.unit === "EA" ? 1 : Number(c.consumeQty || 0),
        };
      });

      const payload = {
        product: {
          master_id,
          barcode: newBarcode.trim(),
          target,
          warehouse_id: target === "stock" ? Number(warehouseId) : undefined,
          location_id:  target === "stock" ? Number(locationId)  : undefined,
        },
        components: compPayload,
      };

      const { data } = await api.post("/products/assemble", payload);
      const newId = data?.product?.id ?? data?.id ?? "?";
      alert(`Ürün oluşturuldu. ID: ${newId}`);

      // reset
      setShowFinalize(false);
      setNewBarcode("");
      setTarget("");
      setWarehouseId("");
      setLocationId("");
      setComponents([]);
      setChoices({});
      setSearch({});
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Hata";
      alert(`Kaydetme hatası: ${msg}`);
      console.error("save error", err?.response?.data || err);
    }
  };

  /* ---------- Yeni tarifi kaydet (BUTON ARTIK COMPONENTLER KARTINDA) ---------- */
  const handleSaveRecipe = async () => {
    try {
      if (recipeMode !== "new") return;
      if (!newRecipeName.trim()) { alert("Tarif adı zorunlu."); return; }
      if (!productCategoryId || !bantTypeId) { alert("PRODUCT/BANT kimliği bulunamadı."); return; }
      if (!components.length) { alert("Tarife eklenecek component yok."); return; }

      // component seçili satırlardan master bazında miktar topla
      const totals = new Map<number, number>();
      for (const c of components) {
        const sid = c.stock?.master_id;
        if (!sid) continue;
        const add = c.stock?.unit === "EA" ? 1 : Number(c.consumeQty || 0);
        const prev = totals.get(sid) || 0;
        totals.set(sid, prev + add);
      }
      if (totals.size === 0) { alert("Hiçbir satırda geçerli component seçimi yok."); return; }

      const items = Array.from(totals.entries()).map(([component_master_id, quantity]) => ({
        component_master_id,
        quantity,
      }));

      const payload = {
        master: {
          category_id: productCategoryId,
          type_id: bantTypeId,
          recipe_name: newRecipeName.trim(), // display_label olarak da kullanılacak (BE’de)
        },
        items,
      };

      const { data } = await api.post("/recipes", payload);
      // { master_id, recipe_id, recipe_name }
      const rid = data?.recipe_id || "";
      const mid = data?.master_id || null;

      if (mid) setSelectedRecipeMasterId(mid);
      if (rid) setRecipeId(rid);

      await loadRecipes();
      alert(`Tarif kaydedildi${rid ? ` (ID: ${rid})` : ""}.`);

      // finalize’ı yine kapalı tut (tarif değişti = yeni seçildi)
      invalidateFinalize();
      setRecipeMode("existing");
    } catch (err: any) {
      const msg = err?.response?.data?.message || err?.message || "Hata";
      alert(`Tarif kaydetme hatası: ${msg}`);
      console.error("save recipe error", err?.response?.data || err);
    }
  };

  /* ==================================================== */
  return (
    <div className="space-y-6 overflow-x-hidden">
      <PageMeta title="Ürün Oluşturma | TailAdmin" description="Stoktaki kalemlerden yeni ürün oluştur" />
      <PageBreadcrumb pageTitle="Ürün Oluşturma" />

      {/* TARİF (üst) */}
      <ComponentCard title="Tarif">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <Label>Tarif Modu</Label>
            <Select
              options={recipeModeOptions}
              value={recipeMode}
              onChange={handleChangeRecipeMode}
              placeholder="Seçiniz"
            />
          </div>

          {recipeMode === "existing" && (
            <div className="md:col-span-2">
              <Label>Tarif</Label>
              <Select
                options={recipeSelectOptions}
                value={recipeId}
                onChange={handleSelectRecipe}
                placeholder="Tarif seçiniz"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Tarif seçildiğinde satırlar beklenen komponent master’ları ve miktarlarıyla gelir.
              </p>
            </div>
          )}

          {recipeMode === "new" && (
            <div className="md:col-span-2">
              <Label>Yeni Tarif Adı <span className="text-rose-600">*</span></Label>
              <Input
                value={newRecipeName}
                onChange={(e) => {
                  setNewRecipeName(e.target.value);
                  // isim değişimi de pratikte "tarif değişimi" sayılır → finalize’ı kapalı tutalım
                  invalidateFinalize();
                }}
                placeholder="Örn. Kırmızı Bant (50mm)"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Bu isim benzersiz olmalı. Kaydedildiğinde PRODUCT/BANT altında master oluşturulur ve tarife bağlanır.
              </p>
            </div>
          )}
        </div>
      </ComponentCard>

      {/* COMPONENTLER */}
      <ComponentCard title="Componentler">
        <div className="space-y-4">
          {components.map((c, idx) => {
            const selected = c.stock;
            const q = search[c.key] ?? "";
            const allRows = choices[c.key] ?? [];

            const visibleRows = allRows
              .filter(r => r.id === selected?.id || !selectedIds.includes(r.id))
              .sort((a, b) => {
                const em = c.expectedMasterId;
                if (!em) return 0;
                const aa = a.master_id === em ? 0 : 1;
                const bb = b.master_id === em ? 0 : 1;
                return aa - bb;
              });

            return (
              <div
                key={c.key}
                className="relative grid items-start gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(160px,220px)_minmax(120px,160px)_auto]"
              >
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
                              <th className="px-3 py-2">Birim</th>
                              <th className="px-3 py-2">Miktar</th>
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
                                  <td className="px-3 py-2">{r.unit}</td>
                                  <td className="px-3 py-2">{r.quantity}</td>
                                  <td className="px-3 py-2">{r.warehouse.name}</td>
                                  <td className="px-3 py-2">{r.location.name}</td>
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
                        <Button variant="outline" onClick={() => toggleDropdown(idx, false)}>
                          Kapat
                        </Button>
                      </div>
                    </div>
                  )}

                  {selected && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Birim: {selected.unit} • Mevcut: {selected.quantity} • {selected.warehouse.name} /{" "}
                      {selected.location.name}
                    </div>
                  )}
                  {!selected && c.expectedLabel && (
                    <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Beklenen: {c.expectedLabel}
                    </div>
                  )}
                </div>

                <div>
                  <Label>Kullanılacak Miktar</Label>
                  {selected?.unit === "EA" ? (
                    <Input disabled value="1" />
                  ) : (
                    <Input
                      type="number"
                      min="0"
                      max={String(selected?.quantity ?? 0)}
                      value={c.consumeQty ?? ""}
                      onChange={(e) => setConsumeQty(c.key, e.target.value)}
                      placeholder={selected ? `0 - ${selected.quantity}` : (c.expectedLabel ? `Öneri: ${c.consumeQty ?? ""}` : "")}
                      disabled={!selected && !c.expectedMasterId}
                    />
                  )}
                </div>

                <div className="md:justify-self-start">
                  <Label>Birim</Label>
                  <div className="h-11 flex items-center">
                    <span className="text-sm text-gray-800 dark:text-gray-100">{selected?.unit ?? "—"}</span>
                  </div>
                </div>

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

        {/* ALT BUTONLAR — Tarifi Kaydet + Devam Et */}
        <div className="mt-6 flex flex-wrap items-center gap-3">
          {recipeMode === "new" && (
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
            disabled={!recipeReady || components.length === 0 || !componentsValid}
          >
            Devam Et
          </Button>

          {!recipeReady && <span className="text-xs text-amber-600">Önce tarif seçin / kaydedin.</span>}
          {components.length > 0 && !componentsValid && (
            <span className="text-xs text-amber-600">M/KG miktarları geçerli olmalı.</span>
          )}
        </div>
      </ComponentCard>

      {/* BARKOD & HEDEF */}
      {showFinalize && (
        <ComponentCard title="Barkod & Hedef">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
            <div>
              <Label>Barkod (Zorunlu)</Label>
              <Input
                value={newBarcode}
                onChange={(e) => setNewBarcode(e.target.value)}
                placeholder="Yeni ürün barkodu"
              />
            </div>

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
              <Label>Depo</Label>
              <Select
                options={[
                  { value: "", label: "Seçiniz", disabled: true },
                  ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
                ]}
                value={warehouseId}
                onChange={async (v: string) => {
                  setWarehouseId(v);
                  setLocationId("");
                  await ensureLocations(v);
                }}
                placeholder="Seçiniz"
                disabled={target !== "stock"}
              />
            </div>

            <div>
              <Label>Lokasyon</Label>
              <Select
                options={[
                  { value: "", label: "Seçiniz", disabled: true },
                  ...(
                    warehouseId
                      ? (locationsByWarehouse[Number(warehouseId)] || [])
                      : []
                  ).map((l) => ({ value: String(l.id), label: l.name })),
                ]}
                value={locationId}
                onChange={(v: string) => setLocationId(v)}
                placeholder="Seçiniz"
                disabled={target !== "stock" || !warehouseId}
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button variant="outline" onClick={() => setShowFinalize(false)}>
              Geri
            </Button>
            <Button variant="primary" disabled={!finalizeValid} onClick={handleSaveProduct}>
              Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}
    </div>
  );
}
