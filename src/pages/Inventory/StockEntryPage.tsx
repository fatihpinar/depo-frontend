// src/pages/Stock/StockEntry.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import api from "../../services/api";

/* UI Components */
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";

/* ============= TYPES ============= */

type StockUnitCode = "area" | "weight" | "length" | "unit";

interface Category {
  id: number;
  name: string;
}

interface TypeRow {
  id: number;
  name: string;
  category_id: number;
}

interface Supplier {
  id: number;
  name: string;
}

interface StockUnit {
  id: number;
  code: StockUnitCode;
  label: string;
  is_active?: boolean;
  sort_order?: number;
}

interface Warehouse {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
  warehouse_id: number;
}

interface Master {
  id: number;
  display_label: string;
  category_id: number;
  type_id: number;
  supplier_id?: number | null;
  stock_unit_id: number;

  // join fields (opsiyonel)
  category_name?: string;
  type_name?: string;
  supplier_name?: string;
  stock_unit_code?: StockUnitCode;
  stock_unit_label?: string;
}

interface Row {
  id: string;
  master_id: number;
  display_label: string;
  qty: number;

  width?: string;
  height?: string;
  weight?: string;
  length?: string;

  warehouse_id?: string;
  location_id?: string;
  invoice_no?: string;

  stock_unit_code?: StockUnitCode; // master’dan
}

interface AlertState {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

interface GlobalSettings {
  invoice: string;
  warehouse: string;
  location: string;
}

/* ============= UTILS ============= */

const uid = (): string => Math.random().toString(36).slice(2);

const createSelectOption = (
  value: string | number,
  label: string,
  disabled = false
) => ({
  value: String(value),
  label,
  disabled,
});

function useDebouncedValue<T>(value: T, delayMs: number) {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(t);
  }, [value, delayMs]);

  return debounced;
}

/* ============= MASTER INLINE FORM (SIRALI / TEKİL LOOKUP KAYIT) ============= */

interface MasterInlineFormProps {
  categories: Category[];
  suppliers: Supplier[];
  stockUnits: StockUnit[];
  onCreated: (created: Master) => void;

  // create lookup callbacks (page’de yazıyoruz)
  onCreateCategory: (name: string) => Promise<Category>;
  onCreateType: (name: string, categoryId: number) => Promise<TypeRow>;
  onCreateSupplier: (name: string) => Promise<Supplier>;
}

function MasterInlineForm({
  categories,
  suppliers,
  stockUnits,
  onCreated,
  onCreateCategory,
  onCreateType,
  onCreateSupplier,
}: MasterInlineFormProps) {
  const [saving, setSaving] = useState(false);

  // form
  const [displayLabel, setDisplayLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [supplierId, setSupplierId] = useState(""); // nullable
  const [stockUnitId, setStockUnitId] = useState("");

  // types list depends on category
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // “+ new”
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

  const [addingType, setAddingType] = useState(false);
  const [newTypeName, setNewTypeName] = useState("");

  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const categoryOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...categories.map((c) => createSelectOption(c.id, c.name)),
      createSelectOption("new", "+ Yeni Kategori Ekle"),
    ],
    [categories]
  );

  const typeOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...types.map((t) => createSelectOption(t.id, t.name)),
      createSelectOption("new", "+ Yeni Tür Ekle"),
    ],
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz"),
      ...suppliers.map((s) => createSelectOption(s.id, s.name)),
      createSelectOption("new", "+ Yeni Tedarikçi Ekle"),
    ],
    [suppliers]
  );

  const stockUnitOptions = useMemo(() => {
    const list = [...stockUnits]
      .filter((x) => x.is_active !== false)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((su) => createSelectOption(su.id, su.label));

    return [createSelectOption("", "Seçiniz", true), ...list];
  }, [stockUnits]);

  const loadTypes = useCallback(async (catId: number) => {
    setTypesLoading(true);
    try {
      const res = await api.get(`/lookups/types/${catId}`);
      setTypes(res.data || []);
    } catch (e) {
      console.error(e);
      setTypes([]);
    } finally {
      setTypesLoading(false);
    }
  }, []);

  useEffect(() => {
    // category değişince type reset + types yükle
    setTypeId("");
    setAddingType(false);
    setNewTypeName("");
    setTypes([]);

    const id = Number(categoryId);
    if (!id) return;
    loadTypes(id);
  }, [categoryId, loadTypes]);

  const handleCategoryChange = (val: string) => {
    if (val === "new") {
      setAddingCategory(true);
      setCategoryId("");
      setTypeId("");
      setTypes([]);
    } else {
      setAddingCategory(false);
      setNewCategoryName("");
      setCategoryId(val);
    }
  };

  const handleTypeChange = (val: string) => {
    if (val === "new") {
      if (!categoryId) {
        alert("Önce kategori seçiniz.");
        return;
      }
      setAddingType(true);
      setTypeId("");
    } else {
      setAddingType(false);
      setNewTypeName("");
      setTypeId(val);
    }
  };

  const handleSupplierChange = (val: string) => {
    if (val === "new") {
      setAddingSupplier(true);
      setSupplierId("");
    } else {
      setAddingSupplier(false);
      setNewSupplierName("");
      setSupplierId(val);
    }
  };

  // ✅ Dropdown içinden tekil kayıt: Kaydet & Seç
  const handleSaveCategoryOnly = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) {
      alert("Kategori adı zorunlu.");
      return;
    }

    try {
      const created = await onCreateCategory(name);

      // otomatik seç + type reset + types yükle
      setCategoryId(String(created.id));
      setAddingCategory(false);
      setNewCategoryName("");

      setTypeId("");
      setTypes([]);
      await loadTypes(created.id);
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Kategori kaydedilemedi.";
      alert(msg);
    }
  }, [newCategoryName, onCreateCategory, loadTypes]);

  const handleSaveTypeOnly = useCallback(async () => {
    const catId = Number(categoryId);
    if (!catId) {
      alert("Önce kategori seçiniz.");
      return;
    }

    const name = newTypeName.trim();
    if (!name) {
      alert("Tür adı zorunlu.");
      return;
    }

    try {
      const created = await onCreateType(name, catId);

      // listede görünsün + otomatik seç
      setTypes((prev) => {
        const already = prev.some((x) => x.id === created.id);
        return already ? prev : [...prev, created];
      });
      setTypeId(String(created.id));
      setAddingType(false);
      setNewTypeName("");
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Tür kaydedilemedi.";
      alert(msg);
    }
  }, [categoryId, newTypeName, onCreateType]);

  const handleSaveSupplierOnly = useCallback(async () => {
    const name = newSupplierName.trim();
    if (!name) {
      alert("Tedarikçi adı zorunlu.");
      return;
    }

    try {
      const created = await onCreateSupplier(name);
      setSupplierId(String(created.id));
      setAddingSupplier(false);
      setNewSupplierName("");
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Tedarikçi kaydedilemedi.";
      alert(msg);
    }
  }, [newSupplierName, onCreateSupplier]);

  const validate = (): string[] => {
    const missing: string[] = [];
    if (!displayLabel.trim()) missing.push("Ürün Tanımı");
    if (!categoryId) missing.push("Kategori");
    if (!typeId) missing.push("Tür");
    if (!stockUnitId) missing.push("Ölçü Birimi");
    return missing;
  };

  const resetForm = () => {
    setDisplayLabel("");
    setCategoryId("");
    setTypeId("");
    setSupplierId("");
    setStockUnitId("");
    setTypes([]);

    setAddingCategory(false);
    setNewCategoryName("");
    setAddingType(false);
    setNewTypeName("");
    setAddingSupplier(false);
    setNewSupplierName("");
  };

  // ✅ Master kaydı artık lookup yaratmaz; sadece seçili id’lerle kaydeder.
  const handleSaveMaster = async () => {
    const missing = validate();
    if (missing.length) {
      alert("Zorunlu alan(lar) eksik:\n- " + missing.join("\n- "));
      return;
    }

    setSaving(true);
    try {
      const payload = {
        display_label: displayLabel.trim(),
        category_id: Number(categoryId),
        type_id: Number(typeId),
        supplier_id: supplierId ? Number(supplierId) : null,
        stock_unit_id: Number(stockUnitId),
      };

      const res = await api.post("/masters", payload);
      const created: Master = res.data;

      alert("Tanım kaydedildi.");
      onCreated(created);
      resetForm();
    } catch (e: any) {
      console.error(e);
      const msg = e?.response?.data?.message || "Tanım kaydedilemedi.";
      alert(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <Label>
          Ürün Tanımı <span className="text-red-500">*</span>
        </Label>
        <Input
          type="text"
          value={displayLabel}
          onChange={(e) => setDisplayLabel(e.target.value)}
          placeholder="Örn: Çift taraflı bant 1mm"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>
            Kategori <span className="text-red-500">*</span>
          </Label>
          <Select
            options={categoryOptions}
            value={categoryId}
            onChange={handleCategoryChange}
            placeholder="Seçiniz"
          />

          {addingCategory && (
            <div className="mt-2 space-y-2">
              <div>
                <Label>Yeni Kategori Adı</Label>
                <Input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="Örn: Bant"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveCategoryOnly}
                  disabled={!newCategoryName.trim()}
                >
                  Kategori Kaydet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddingCategory(false);
                    setNewCategoryName("");
                  }}
                >
                  İptal
                </Button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not: Kategori kaydedilince otomatik seçilir. Sonra Tür ekleyebilirsin.
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Tür <span className="text-red-500">*</span>
          </Label>
          <Select
            options={typeOptions}
            value={typeId}
            onChange={handleTypeChange}
            placeholder={
              !categoryId
                ? "Önce kategori seçiniz"
                : typesLoading
                ? "Yükleniyor..."
                : "Seçiniz"
            }
          />

          {addingType && (
            <div className="mt-2 space-y-2">
              <div>
                <Label>Yeni Tür Adı</Label>
                <Input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  placeholder="Örn: Çift Taraflı Köpük Bant"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveTypeOnly}
                  disabled={!newTypeName.trim() || !categoryId}
                >
                  Tür Kaydet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddingType(false);
                    setNewTypeName("");
                  }}
                >
                  İptal
                </Button>
              </div>

              <div className="text-xs text-gray-500 dark:text-gray-400">
                Not: Tür eklemek için kategori seçili olmalı.
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>Tedarikçi</Label>
          <Select
            options={supplierOptions}
            value={supplierId}
            onChange={handleSupplierChange}
            placeholder="Seçiniz"
          />

          {addingSupplier && (
            <div className="mt-2 space-y-2">
              <div>
                <Label>Yeni Tedarikçi Adı</Label>
                <Input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Örn: 3M"
                />
              </div>

              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveSupplierOnly}
                  disabled={!newSupplierName.trim()}
                >
                  Tedarikçi Kaydet
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddingSupplier(false);
                    setNewSupplierName("");
                  }}
                >
                  İptal
                </Button>
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Ölçü Birimi <span className="text-red-500">*</span>
          </Label>
          <Select
            options={stockUnitOptions}
            value={stockUnitId}
            onChange={setStockUnitId}
            placeholder="Seçiniz"
          />
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Button variant="primary" onClick={handleSaveMaster} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Tanımı Kaydet"}
        </Button>
      </div>

      <div className="text-xs text-gray-500 dark:text-gray-400">
        Not: Kategori / Tür / Tedarikçi ekleme işlemleri “tekil kaydet & seç” mantığıyla çalışır; master kaydı ayrı kaydedilir.
      </div>
    </div>
  );
}

/* ============= STOCK ROW (AYNEN KALSIN) ============= */

interface StockRowProps {
  row: Row;
  warehouseOptions: { value: string; label: string }[];
  locationsByWarehouse: Record<number, Location[]>;
  onUpdate: (id: string, updates: Partial<Row>) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  ensureLocations: (warehouseId: string | number) => Promise<Location[]>;
}

function StockRow({
  row,
  warehouseOptions,
  locationsByWarehouse,
  onUpdate,
  onClone,
  onDelete,
  ensureLocations,
}: StockRowProps) {
  const locationOptions = useMemo(() => {
    const wh = row.warehouse_id || "";
    const locations = wh ? locationsByWarehouse[Number(wh)] || [] : [];
    return locations.map((l) => createSelectOption(l.id, l.name));
  }, [row.warehouse_id, locationsByWarehouse]);

  const stockUnit = (row.stock_unit_code || "area") as StockUnitCode;
  const isArea = stockUnit === "area";
  const isWeight = stockUnit === "weight";
  const isLength = stockUnit === "length";

  const handleWarehouseChange = async (val: string) => {
    const locs = await ensureLocations(val);
    const current = row.location_id;
    const stillValid = locs.some((l) => String(l.id) === String(current));
    const nextLocId = stillValid ? current : String(locs[0]?.id || "");
    onUpdate(row.id, { warehouse_id: val, location_id: nextLocId });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-800 p-4">
      {/* Mobile: Card Layout */}
      <div className="block md:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex-1">
            <div className="flex flex-col">
              <span
                className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate"
                title={row.display_label}
              >
                {row.display_label}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onClone(row.id)}
            >
              <span title="Klonla" aria-hidden>
                +
              </span>
              <span className="sr-only">Klonla</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onDelete(row.id)}
            >
              <span title="Sil" aria-hidden>
                -
              </span>
              <span className="sr-only">Sil</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Adet</Label>
              <Input
                type="number"
                min="1"
                value={String(row.qty)}
                onChange={(e) =>
                  onUpdate(row.id, {
                    qty: Math.max(1, parseInt(e.target.value || "1", 10)),
                  })
                }
              />
            </div>
            <div>
              <Label>En (m)</Label>
              <Input
                type="number"
                min="0"
                value={row.width || ""}
                onChange={(e) => onUpdate(row.id, { width: e.target.value })}
                disabled={!isArea}
              />
            </div>
            <div>
              <Label>Boy (m)</Label>
              <Input
                type="number"
                min="0"
                value={row.height || ""}
                onChange={(e) => onUpdate(row.id, { height: e.target.value })}
                disabled={!isArea}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Ağırlık (kg)</Label>
              <Input
                type="number"
                min="0"
                value={row.weight || ""}
                onChange={(e) => onUpdate(row.id, { weight: e.target.value })}
                disabled={!isWeight}
              />
            </div>
            <div>
              <Label>Uzunluk (m)</Label>
              <Input
                type="number"
                min="0"
                value={row.length || ""}
                onChange={(e) => onUpdate(row.id, { length: e.target.value })}
                disabled={!isLength}
              />
            </div>
          </div>

          <div>
            <Label>Depo</Label>
            <Select
              options={warehouseOptions}
              value={row.warehouse_id || ""}
              placeholder="Depo Seçiniz"
              onChange={handleWarehouseChange}
            />
          </div>

          <div>
            <Label>Lokasyon</Label>
            <Select
              options={locationOptions}
              value={row.location_id || ""}
              placeholder="Lokasyon Seçiniz"
              onChange={(val: string) => onUpdate(row.id, { location_id: val })}
            />
          </div>

          <div>
            <Label>Fatura No</Label>
            <Input
              type="text"
              value={row.invoice_no || ""}
              onChange={(e) => onUpdate(row.id, { invoice_no: e.target.value })}
              placeholder="Opsiyonel"
            />
          </div>
        </div>
      </div>

      {/* Desktop: 2 satırlı grid düzeni */}
      <div className="hidden md:block">
        <div className="space-y-2">
          {/* Row 1 */}
          <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_auto] gap-2 items-center">
            <div
              className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
              title={row.display_label}
            >
              {row.display_label}
            </div>

            <div className="relative">
              <Input
                type="number"
                min="1"
                value={String(row.qty)}
                onChange={(e) =>
                  onUpdate(row.id, {
                    qty: Math.max(1, parseInt(e.target.value || "1", 10)),
                  })
                }
                className="pr-8"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 pointer-events-none">
                Ad.
              </span>
            </div>

            <Input
              type="number"
              min="0"
              step="0.01"
              value={row.width || ""}
              onChange={(e) => onUpdate(row.id, { width: e.target.value })}
              placeholder="En (m)"
              disabled={!isArea}
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              value={row.height || ""}
              onChange={(e) => onUpdate(row.id, { height: e.target.value })}
              placeholder="Boy (m)"
              disabled={!isArea}
            />

            <Select
              options={warehouseOptions}
              value={row.warehouse_id || ""}
              placeholder="Depo Seçiniz"
              onChange={handleWarehouseChange}
            />

            <Button
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => onClone(row.id)}
            >
              <span aria-hidden>+</span>
            </Button>
          </div>

          {/* Row 2 */}
          <div className="grid grid-cols-[2.5fr_1fr_1fr_1fr_1.5fr_auto] gap-2 items-center">
            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 truncate">
              {row.stock_unit_code ? `Ölçü: ${row.stock_unit_code}` : "—"}
            </div>

            <Input
              type="text"
              value={row.invoice_no || ""}
              onChange={(e) => onUpdate(row.id, { invoice_no: e.target.value })}
              placeholder="Fatura No"
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              value={row.weight || ""}
              onChange={(e) => onUpdate(row.id, { weight: e.target.value })}
              placeholder="Ağırlık (kg)"
              disabled={!isWeight}
            />

            <Input
              type="number"
              min="0"
              step="0.01"
              value={row.length || ""}
              onChange={(e) => onUpdate(row.id, { length: e.target.value })}
              placeholder="Uzunluk (m)"
              disabled={!isLength}
            />

            <Select
              options={locationOptions}
              value={row.location_id || ""}
              placeholder="Lokasyon Seçiniz"
              onChange={(val: string) => onUpdate(row.id, { location_id: val })}
            />

            <Button
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => onDelete(row.id)}
            >
              <span aria-hidden>-</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= PAGE ============= */

export default function StockEntryPage() {
  // Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});

  // Masters
  const [mastersRaw, setMastersRaw] = useState<Master[]>([]);

  // Filters
  const [filterCategoryId, setFilterCategoryId] = useState<string>("");
  const [filterTypeId, setFilterTypeId] = useState<string>("");
  const [filterSupplierId, setFilterSupplierId] = useState<string>("");
  const [masterSearch, setMasterSearch] = useState("");

  // ✅ debounce: arama yazarken her harfte request atmasın
  const debouncedSearch = useDebouncedValue(masterSearch, 350);

  // Selection
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  // Rows & Global Settings (stok girişi)
  const [rows, setRows] = useState<Row[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    invoice: "",
    warehouse: "",
    location: "",
  });

  // UI State
  const [uiAlert, setUiAlert] = useState<AlertState | null>(null);
  const rowsSectionRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  const showAlert = useCallback((alert: AlertState) => {
    setUiAlert(alert);
    setTimeout(() => {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const refreshMasters = useCallback(async () => {
    const params = new URLSearchParams();
    if (filterCategoryId) params.set("categoryId", filterCategoryId);
    if (filterTypeId) params.set("typeId", filterTypeId);
    if (filterSupplierId) params.set("supplierId", filterSupplierId);
    if (debouncedSearch.trim()) params.set("search", debouncedSearch.trim());

    const qs = params.toString() ? `?${params.toString()}` : "";
    const res = await api.get(`/masters${qs}`);
    setMastersRaw(res.data || []);
  }, [filterCategoryId, filterTypeId, filterSupplierId, debouncedSearch]);

  // initial load
  useEffect(() => {
    (async () => {
      try {
        const [catRes, supRes, suRes, whRes] = await Promise.all([
          api.get("/lookups/categories"),
          api.get("/lookups/suppliers"),
          api.get("/lookups/stock-units"),
          api.get("/lookups/warehouses"),
        ]);

        setCategories(catRes.data || []);
        setSuppliers(supRes.data || []);
        setStockUnits(suRes.data || []);
        setWarehouses(whRes.data || []);

        // initial masters
        const mRes = await api.get("/masters");
        setMastersRaw(mRes.data || []);
      } catch (e) {
        console.error(e);
        showAlert({
          variant: "error",
          title: "Yükleme hatası",
          message: "Lookups veya master listesi yüklenemedi.",
        });
      }
    })();
  }, [showAlert]);

  // filter category -> load types + reset type filter
  useEffect(() => {
    setFilterTypeId("");
    setTypes([]);

    const catId = Number(filterCategoryId);
    if (!catId) return;

    api
      .get(`/lookups/types/${catId}`)
      .then((r) => setTypes(r.data || []))
      .catch((e) => {
        console.error(e);
        setTypes([]);
      });
  }, [filterCategoryId]);

  // ✅ any filter change -> reload masters (kategori/tür/tedarikçi değişince anında)
  useEffect(() => {
    refreshMasters().catch((e) => console.error(e));
  }, [refreshMasters]);

  const categoryOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...categories.map((c) => createSelectOption(c.id, c.name)),
    ],
    [categories]
  );

  const typeOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...types.map((t) => createSelectOption(t.id, t.name)),
    ],
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...suppliers.map((s) => createSelectOption(s.id, s.name)),
    ],
    [suppliers]
  );

  const warehouseOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...warehouses.map((w) => createSelectOption(w.id, w.name)),
    ],
    [warehouses]
  );

  const ensureLocations = useCallback(
    async (warehouseId: string | number): Promise<Location[]> => {
      const id = Number(warehouseId);
      if (!id) return [];

      if (locationsByWarehouse[id]) return locationsByWarehouse[id];

      const res = await api.get(`/lookups/locations?warehouseId=${id}`);
      const list: Location[] = res.data || [];
      setLocationsByWarehouse((prev) => ({ ...prev, [id]: list }));
      return list;
    },
    [locationsByWarehouse]
  );

  const globalLocationOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...(globalSettings.warehouse
        ? locationsByWarehouse[Number(globalSettings.warehouse)] || []
        : []
      ).map((l) => createSelectOption(l.id, l.name)),
    ],
    [globalSettings.warehouse, locationsByWarehouse]
  );

  // ✅ Panel listesi artık server filtreli geliyor; ayrıca “ölçü birimi” arama kapsamından çıkarıldı.
  // Yine de UI tarafında ekstra filtre istemiyorsan aynen mastersRaw kullanıyoruz.
  const filteredForPanel = useMemo(() => mastersRaw, [mastersRaw]);

  const handleApplySelections = useCallback(() => {
    const currentMasterIds = new Set(rows.map((r) => String(r.master_id)));
    const toAdd = selectedMasterIds.filter((id) => !currentMasterIds.has(id));

    const newRows: Row[] = toAdd.map((id) => {
      const master = mastersRaw.find((m) => String(m.id) === id)!;

      return {
        id: uid(),
        master_id: master.id,
        display_label: master.display_label,
        qty: 1,

        width: "",
        height: "",
        weight: "",
        length: "",

        warehouse_id: "",
        location_id: "",
        invoice_no: globalSettings.invoice || "",

        stock_unit_code: master.stock_unit_code,
      };
    });

    const mastersToKeep = new Set(selectedMasterIds);
    const rowsAfterRemoval = rows.filter((r) => mastersToKeep.has(String(r.master_id)));

    const removedCount = rows.length - rowsAfterRemoval.length;
    if (removedCount > 0) {
      const ok = confirm(`${removedCount} satır kaldırılacak. Devam edilsin mi?`);
      if (!ok) return;
    }

    setRows([...rowsAfterRemoval, ...newRows]);
    setTimeout(() => {
      rowsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }, [rows, selectedMasterIds, mastersRaw, globalSettings.invoice]);

  const updateRow = useCallback((id: string, updates: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...updates } : r)));
  }, []);

  const cloneRow = useCallback((rowId: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((x) => x.id === rowId);
      if (idx === -1) return prev;

      const original = prev[idx];
      const copy: Row = { ...original, id: uid(), qty: 1 };
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const handleGlobalWarehouseChange = useCallback(
    async (val: string) => {
      setGlobalSettings((prev) => ({ ...prev, warehouse: val }));
      const locs = await ensureLocations(val);
      const firstLoc = String(locs[0]?.id || "");
      setGlobalSettings((prev) => ({ ...prev, location: firstLoc }));
    },
    [ensureLocations]
  );

  const applyGlobalsToAll = useCallback(async () => {
    let nextRows = [...rows];

    if (globalSettings.warehouse) {
      const locs = await ensureLocations(globalSettings.warehouse);
      const firstLocId = globalSettings.location || String(locs[0]?.id || "");

      nextRows = nextRows.map((r) => ({
        ...r,
        warehouse_id: globalSettings.warehouse,
        location_id: firstLocId,
      }));

      if (!globalSettings.location) {
        setGlobalSettings((prev) => ({ ...prev, location: firstLocId }));
      }
    }

    nextRows = nextRows.map((r) => ({
      ...r,
      invoice_no: globalSettings.invoice,
    }));

    setRows(nextRows);
  }, [rows, globalSettings, ensureLocations]);

  const isStockSaveEnabled =
    rows.length > 0 &&
    rows.every((r) => Number(r.qty) >= 1 && r.warehouse_id && r.location_id);

  // stok kaydet (aynı mantık, sadece stock_unit_code üzerinden)
  const handleSaveStock = useCallback(async () => {
    try {
      if (!rows.length) {
        showAlert({
          variant: "warning",
          title: "Eksik bilgi",
          message: "Önce tanım seçip satır oluşturun.",
        });
        return;
      }

      const dimErrors: string[] = [];

      rows.forEach((r, idx) => {
        const master = mastersRaw.find((m) => m.id === r.master_id);
        const stockUnit = (master?.stock_unit_code || r.stock_unit_code || "area") as StockUnitCode;

        const w = r.width ? Number(r.width) : NaN;
        const h = r.height ? Number(r.height) : NaN;
        const weight = r.weight ? Number(r.weight) : NaN;
        const length = r.length ? Number(r.length) : NaN;

        if (stockUnit === "area") {
          if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) dimErrors.push(String(idx + 1));
        } else if (stockUnit === "weight") {
          if (!Number.isFinite(weight) || weight <= 0) dimErrors.push(String(idx + 1));
        } else if (stockUnit === "length") {
          if (!Number.isFinite(length) || length <= 0) dimErrors.push(String(idx + 1));
        } else if (stockUnit === "unit") {
          // sadece qty yeterli
        }
      });

      if (dimErrors.length) {
        showAlert({
          variant: "warning",
          title: "Ölçü alanı eksik veya hatalı",
          message:
            "Şu satırlarda stok birimine göre ölçü alanları zorunludur ve 0'dan büyük olmalıdır: " +
            dimErrors.join(", "),
        });
        return;
      }

      const payload: any[] = [];
      rows.forEach((r) => {
        const master = mastersRaw.find((m) => m.id === r.master_id);
        const stockUnit = (master?.stock_unit_code || r.stock_unit_code || "area") as StockUnitCode;

        const width = r.width ? Number(r.width) : null;
        const height = r.height ? Number(r.height) : null;
        const weight = r.weight ? Number(r.weight) : null;
        const length = r.length ? Number(r.length) : null;

        for (let i = 0; i < Number(r.qty); i++) {
          payload.push({
            master_id: r.master_id,
            unit: "EA",
            quantity: 1,
            warehouse_id: Number(r.warehouse_id),
            location_id: Number(r.location_id),

            width: stockUnit === "area" ? width : null,
            height: stockUnit === "area" ? height : null,
            weight: stockUnit === "weight" ? weight : null,
            length: stockUnit === "length" ? length : null,

            invoice_no: r.invoice_no?.trim() || null,
          });
        }
      });

      const res = await api.post("/components/bulk", payload);

      showAlert({
        variant: "success",
        title: "Stok kaydı tamamlandı",
        message: `${res?.data?.length ?? payload.length} kayıt eklendi.`,
      });

      setRows([]);
    } catch (err: any) {
      console.error("Stok kaydı hatası:", err);
      showAlert({
        variant: "error",
        title: "Beklenmeyen hata",
        message: "Stok kaydı sırasında bir sorun oluştu.",
      });
    }
  }, [rows, mastersRaw, showAlert]);

  // Lookup create handlers (aynı kalsın)
  const handleCreateCategory = useCallback(
    async (name: string): Promise<Category> => {
      const exists = categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (exists) return exists;

      const res = await api.post("/lookups/categories", { name });
      const created = res.data as Category;

      setCategories((prev) => [...prev, created]);
      return created;
    },
    [categories]
  );

  const handleCreateType = useCallback(
    async (name: string, categoryId: number): Promise<TypeRow> => {
      const exists = types.find(
        (t) => t.category_id === categoryId && t.name.toLowerCase() === name.toLowerCase()
      );
      if (exists) return exists;

      const res = await api.post("/lookups/types", { name, category_id: categoryId });
      const created = res.data as TypeRow;

      setTypes((prev) => [...prev, created]);
      return created;
    },
    [types]
  );

  const handleCreateSupplier = useCallback(
    async (name: string): Promise<Supplier> => {
      const exists = suppliers.find((s) => s.name.toLowerCase() === name.toLowerCase());
      if (exists) return exists;

      const res = await api.post("/lookups/suppliers", { name });
      const created = res.data as Supplier;

      setSuppliers((prev) => [...prev, created]);
      return created;
    },
    [suppliers]
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title="Stok Girişi"
        description="Master seç + yeni master ekle + satırlardan stok girişi"
      />
      <PageBreadcrumb pageTitle="Stok Girişi" />

      {/* Card #1: Master Selection */}
      <ComponentCard title="Tanım Seçimi">
        <details
          open={createOpen}
          onToggle={(e) => setCreateOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40"
        >
          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white">
            Yeni Tanım Ekle
          </summary>

          <div className="mt-4">
            <MasterInlineForm
              categories={categories}
              suppliers={suppliers}
              stockUnits={stockUnits}
              onCreateCategory={handleCreateCategory}
              onCreateType={handleCreateType}
              onCreateSupplier={handleCreateSupplier}
              onCreated={async (created) => {
                try {
                  const res = await api.get(`/masters/${created.id}`);
                  const full: Master = res.data;
                  setMastersRaw((prev) => [full, ...prev]);
                } catch {
                  setMastersRaw((prev) => [created, ...prev]);
                }

                setSelectedMasterIds((prev) =>
                  Array.from(new Set([...prev, String(created.id)]))
                );
                setCreateOpen(false);
              }}
            />
          </div>
        </details>

        {/* Filters */}
        <div className="mt-4">
          <Label>Tanım Seçimi</Label>
          <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/40">
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-xs dark:border-gray-800 dark:bg-gray-900/40">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.4fr)]">
                <div>
                  <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Kategori
                  </Label>
                  <Select
                    options={categoryOptions}
                    value={filterCategoryId}
                    placeholder="Tümü"
                    onChange={setFilterCategoryId}
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Tür
                  </Label>
                  <Select
                    options={typeOptions}
                    value={filterTypeId}
                    placeholder="Tümü"
                    onChange={setFilterTypeId}
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Tedarikçi
                  </Label>
                  <Select
                    options={supplierOptions}
                    value={filterSupplierId}
                    placeholder="Tümü"
                    onChange={setFilterSupplierId}
                  />
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Arama
                    </Label>
                    <Input
                      type="text"
                      placeholder="Tanım / kategori / tür / tedarikçi"
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                    />
                  </div>

                  <Button
                    variant="outline"
                    className="mt-1 h-10 px-4 text-xs font-medium md:mt-0 md:h-10 md:self-end"
                    onClick={() => {
                      setFilterCategoryId("");
                      setFilterTypeId("");
                      setFilterSupplierId("");
                      setMasterSearch("");
                      setSelectedMasterIds([]);
                    }}
                  >
                    Temizle
                  </Button>
                </div>
              </div>
            </div>

            {/* List */}
            <div className="max-h-64 overflow-auto pr-0">
              <div className="sticky top-0 z-10 grid grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
                <div className="text-left">Ürün Tanımı</div>
                <div className="text-left">Kategori</div>
                <div className="text-left">Tür</div>
                <div className="text-left">Tedarikçi</div>
                <div className="text-left">Ölçü Birimi</div>
              </div>

              {filteredForPanel.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                  Kayıt bulunamadı.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredForPanel.map((m) => {
                    const idStr = String(m.id);
                    const checked = selectedMasterIds.includes(idStr);

                    const catName =
                      m.category_name ||
                      categories.find((c) => c.id === m.category_id)?.name ||
                      "—";

                    const typeName =
                      m.type_name ||
                      types.find((t) => t.id === m.type_id)?.name ||
                      "—";

                    const supplierName =
                      m.supplier_name ||
                      suppliers.find((s) => s.id === m.supplier_id)?.name ||
                      "—";

                    const stockUnitLabel =
                      m.stock_unit_label ||
                      stockUnits.find((su) => su.id === m.stock_unit_id)?.label ||
                      (m.stock_unit_code || "—");

                    return (
                      <li key={idStr}>
                        <label className="grid cursor-pointer grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/60 md:text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedMasterIds((prev) =>
                                  on
                                    ? Array.from(new Set([...prev, idStr]))
                                    : prev.filter((x) => x !== idStr)
                                );
                              }}
                            />
                            <span className="truncate text-gray-800 dark:text-gray-100">
                              {m.display_label || `#${m.id}`}
                            </span>
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {catName}
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {typeName}
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {supplierName}
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {stockUnitLabel}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="primary" onClick={handleApplySelections}>
              Seçilenleri Listele
            </Button>
          </div>
        </div>
      </ComponentCard>

      {/* Card #2: Stock Entry Rows (AYNEN) */}
      {rows.length > 0 && (
        <ComponentCard title="Stok Girişi">
          <div ref={rowsSectionRef} />

          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <Input
              type="text"
              value={globalSettings.invoice}
              onChange={(e) =>
                setGlobalSettings((prev) => ({ ...prev, invoice: e.target.value }))
              }
              placeholder="Fatura No"
            />
            <Select
              options={warehouseOptions.filter((w) => w.value !== "")}
              value={globalSettings.warehouse}
              placeholder="Depo Seçiniz"
              onChange={handleGlobalWarehouseChange}
            />
            <Select
              options={globalLocationOptions.filter((l) => l.value !== "")}
              value={globalSettings.location}
              placeholder="Lokasyon Seçiniz"
              onChange={(val: string) =>
                setGlobalSettings((prev) => ({ ...prev, location: val }))
              }
            />
            <Button
              variant="outline"
              className="w-full md:w-auto"
              onClick={applyGlobalsToAll}
            >
              Tümüne Uygula
            </Button>
          </div>

          <div className="my-4 h-px w-full bg-gray-200 dark:bg-gray-700" />

          <div className="mt-4 space-y-4">
            {rows.map((row) => (
              <StockRow
                key={row.id}
                row={row}
                warehouseOptions={warehouseOptions}
                locationsByWarehouse={locationsByWarehouse}
                onUpdate={updateRow}
                onClone={cloneRow}
                onDelete={deleteRow}
                ensureLocations={ensureLocations}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSaveStock}
              disabled={!isStockSaveEnabled}
            >
              Stok Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}

      <div ref={alertRef} className="mt-4">
        {uiAlert && (
          <Alert
            variant={uiAlert.variant}
            title={uiAlert.title}
            message={uiAlert.message}
          />
        )}
      </div>
    </div>
  );
}