// src/pages/Stock/StockEntry.tsx
// Refactored version - improved readability, performance, and maintainability

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
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

/* ============= TYPE DEFINITIONS ============= */
interface Category {
  id: number;
  name: string;
}

interface TypeRow {
  id: number;
  name: string;
  category_id?: number;
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
  default_unit?: "EA" | "M" | "KG";
  type_id?: number;
  type_name?: string;
}

interface FieldDef {
  key: string;
  label: string;
  kind: "text" | "number" | "select";
  required?: boolean;
  unitSuffix?: string;
  options?: { value: string | number; label: string }[];
}

interface Schema {
  version: string | number;
  baseFields: FieldDef[];
  categoryFields: Record<string, FieldDef[]>;
  categoryMapByName?: Record<string, string>;
}

interface Row {
  id: string;
  master_id: number;
  display_label: string;
  qty: number;
  width?: string;
  height?: string;
  warehouse_id?: string;
  location_id?: string;
  invoice_no?: string;
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

/* ============= UTILITIES ============= */
const uid = (): string => Math.random().toString(36).slice(2);

const createSelectOption = (value: string | number, label: string, disabled = false) => ({
  value: String(value),
  label,
  disabled,
});

const EMPTY_SELECT_OPTION = createSelectOption("", "Seçiniz", true);

/* ============= FIELD RENDERER COMPONENT ============= */
interface FieldRendererProps {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
  selectOptions?: { value: string; label: string }[];
}

function FieldRenderer({ field, value, onChange, disabled, selectOptions }: FieldRendererProps) {
  const requiredMarker = field.required ? " *" : "";
  const suffix = field.unitSuffix && (
    <span className="ml-2 text-xs text-gray-500">{field.unitSuffix}</span>
  );

  const commonLabel = (
    <Label>
      {field.label}
      {requiredMarker}
    </Label>
  );

  if (field.kind === "select") {
    const options = [
      EMPTY_SELECT_OPTION,
      ...(selectOptions || []).map(o => createSelectOption(o.value, o.label))
    ];

    return (
      <div>
        {commonLabel}
        <Select
          options={options}
          value={value ?? ""}
          onChange={onChange}
          placeholder="Seçiniz"
          className={disabled ? "opacity-60 pointer-events-none" : ""}
        />
      </div>
    );
  }

  if (field.kind === "number") {
    return (
      <div>
        {commonLabel}
        <div className="flex items-center">
          <Input
            type="number"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
          />
          {suffix}
        </div>
      </div>
    );
  }

  return (
    <div>
      {commonLabel}
      <Input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

/* ============= MASTER INLINE FORM COMPONENT ============= */
interface MasterInlineFormProps {
  onSaved: (saved: { id: number; display_label: string; type_id?: number }) => void;
  onCancel?: () => void;
}

function MasterInlineForm({ onSaved, onCancel }: MasterInlineFormProps) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>([]);
  
  const [categoryName, setCategoryName] = useState("");
  const [baseValues, setBaseValues] = useState<Record<string, any>>({});
  const [categoryValues, setCategoryValues] = useState<Record<string, any>>({});
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [saving, setSaving] = useState(false);

  // Initial data load
  useEffect(() => {
    Promise.all([
      api.get("/lookups/master-field-schema"),
      api.get("/lookups/categories"),
      api.get("/lookups/suppliers")
    ]).then(([schemaRes, categoriesRes, suppliersRes]) => {
      setSchema(schemaRes.data);
      setCategories(categoriesRes.data);
      setSuppliers(suppliersRes.data);
    });
  }, []);

  // Load types when category changes
  useEffect(() => {
    const category = categories.find(c => c.name === categoryName);
    
    if (!category) {
      setTypes([]);
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      return;
    }

    api.get(`/lookups/types/${category.id}`).then(r => setTypes(r.data));
    setBaseValues({});
    setCategoryValues({});
    setAddingSupplier(false);
    setNewSupplierName("");
  }, [categoryName, categories]);

  // Computed values
  const categoryKey = useMemo(() => {
    if (!schema || !categoryName) return null;
    const byName = schema.categoryMapByName || {};
    return byName[categoryName] || 
           Object.entries(byName).find(([n]) => 
             n.toUpperCase() === categoryName.toUpperCase()
           )?.[1] || null;
  }, [schema, categoryName]);

  const categoryFields = useMemo(
    () => (categoryKey && schema ? schema.categoryFields[categoryKey] || [] : []),
    [schema, categoryKey]
  );

  const typeOptions = useMemo(
    () => types.map(t => createSelectOption(t.id, t.name)),
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      ...suppliers.map(s => createSelectOption(s.id, s.name)),
      createSelectOption("new", "+ Yeni Tedarikçi Ekle")
    ],
    [suppliers]
  );

  // Handlers
  const updateBase = useCallback((key: string, v: any) => {
    if (key === "supplier_id") {
      if (v === "new") {
        setAddingSupplier(true);
        setBaseValues(prev => ({ ...prev, supplier_id: "" }));
      } else {
        setAddingSupplier(false);
        setNewSupplierName("");
        setBaseValues(prev => ({ ...prev, supplier_id: v }));
      }
      return;
    }
    setBaseValues(prev => ({ ...prev, [key]: v }));
  }, []);

  const updateCat = useCallback((key: string, v: any) => {
    setCategoryValues(prev => ({ ...prev, [key]: v }));
  }, []);

  const validateFields = useCallback((): string[] => {
    if (!schema) return [];
    
    const misses: string[] = [];

    schema.baseFields.forEach(f => {
      if (!f.required) return;
      const v = baseValues[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        misses.push(f.label);
      }
    });

    categoryFields.forEach(f => {
      if (!f.required) return;
      const v = categoryValues[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        misses.push(f.label);
      }
    });

    return misses;
  }, [schema, baseValues, categoryValues, categoryFields]);

  const handleSave = async () => {
    if (!schema) return;

    const category = categories.find(c => c.name === categoryName);
    if (!category) {
      alert("Kategori seçiniz.");
      return;
    }

    const missingFields = validateFields();
    if (missingFields.length) {
      alert("Zorunlu alan(lar) eksik:\n- " + missingFields.join("\n- "));
      return;
    }

    setSaving(true);
    try {
      let supplierId: number | null = null;

      if (addingSupplier) {
        const name = newSupplierName.trim();
        if (!name) {
          alert("Yeni tedarikçi adını yazınız.");
          setSaving(false);
          return;
        }

        const exists = suppliers.find(s => 
          s.name.toLowerCase() === name.toLowerCase()
        );

        if (exists) {
          supplierId = exists.id;
        } else {
          const supRes = await api.post("/lookups/suppliers", { name });
          supplierId = supRes.data.id;
          setSuppliers(prev => [...prev, supRes.data]);
        }
      }

      const payload: Record<string, any> = { category_id: category.id };

      schema.baseFields.forEach(f => {
        payload[f.key] = f.key === "supplier_id" && addingSupplier 
          ? supplierId 
          : (baseValues[f.key] ?? null);
      });

      categoryFields
        .filter(f => f.key !== "supplier_lot_no")
        .forEach(f => {
          payload[f.key] = categoryValues[f.key] ?? null;
        });

      const res = await api.post("/masters", payload);

      alert("Tanım kaydedildi.");
      onSaved({
        id: res.data.id,
        display_label: res.data.display_label,
        type_id: res.data.type_id,
      });

      // Reset form
      setCategoryName("");
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      onCancel?.();
    } catch (err: any) {
      console.error("Master kaydetme hatası:", err);
      const { status, data } = err?.response || {};

      if (status === 409 && (data?.code === "duplicate_name" || data?.error === "duplicate_name")) {
        alert("Aynı isim/tür altında kayıt mevcut.");
      } else if (status === 400) {
        alert(data?.message || "Zorunlu alanlar eksik veya hatalı.");
      } else {
        alert("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  const renderBaseField = useCallback((key: string) => {
    const field = schema?.baseFields.find(f => f.key === key);
    if (!field) return null;

    const selectOptions = field.kind === "select"
      ? field.options?.map(o => createSelectOption(o.value, o.label)) ||
        (key === "type_id" ? typeOptions : key === "supplier_id" ? supplierOptions : [])
      : undefined;

    return (
      <FieldRenderer
        field={field}
        value={baseValues[key]}
        onChange={(v) => updateBase(key, v)}
        selectOptions={selectOptions}
      />
    );
  }, [schema, baseValues, updateBase, typeOptions, supplierOptions]);

  const categoryOptions = [
    EMPTY_SELECT_OPTION,
    ...categories.map(c => createSelectOption(c.name, c.name))
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Kategori</Label>
          <Select
            options={categoryOptions}
            value={categoryName}
            onChange={setCategoryName}
            placeholder="Seçiniz"
          />
        </div>

        <div>{renderBaseField("type_id")}</div>

        <div>
          {renderBaseField("supplier_id")}
          {addingSupplier && (
            <div className="mt-2">
              <Label>Yeni Tedarikçi Adı</Label>
              <Input
                type="text"
                value={newSupplierName}
                onChange={(e) => setNewSupplierName(e.target.value)}
                placeholder="Örn: ACME A.Ş."
              />
            </div>
          )}
        </div>

        <div>{renderBaseField("supplier_product_code")}</div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          Kategoriye Özel Alanlar
        </h3>

        {categoryFields.filter(f => f.key !== "supplier_lot_no").length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Bu kategori için ek alan yok.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {categoryFields
              .filter(f => f.key !== "supplier_lot_no")
              .map(cf => (
                <div key={cf.key}>
                  <FieldRenderer
                    field={cf}
                    value={categoryValues[cf.key]}
                    onChange={(v) => updateCat(cf.key, v)}
                    selectOptions={
                      cf.kind === "select"
                        ? cf.options?.map(o => createSelectOption(o.value, o.label))
                        : undefined
                    }
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* ============= STOCK ROW COMPONENT ============= */
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
    const locations = wh ? (locationsByWarehouse[Number(wh)] || []) : [];
    return [
      EMPTY_SELECT_OPTION,
      ...locations.map(l => createSelectOption(l.id, l.name))
    ];
  }, [row.warehouse_id, locationsByWarehouse]);

  const handleWarehouseChange = async (val: string) => {
    const locs = await ensureLocations(val);
    const current = row.location_id;
    const stillValid = locs.some(l => String(l.id) === String(current));
    const nextLocId = stillValid ? current : String(locs[0]?.id || "");
    onUpdate(row.id, { warehouse_id: val, location_id: nextLocId });
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Mobile: Card Layout */}
      <div className="block md:hidden">
        {/* Header with title and actions */}
        <div className="mb-3 flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {row.display_label}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onClone(row.id)}
            >
              <span title="Klonla" aria-hidden>+</span>
              <span className="sr-only">Klonla</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onDelete(row.id)}
            >
              <span title="Sil" aria-hidden>-</span>
              <span className="sr-only">Sil</span>
            </Button>
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Adet</Label>
              <Input
                type="number"
                min="1"
                value={String(row.qty)}
                onChange={(e) => onUpdate(row.id, { 
                  qty: Math.max(1, parseInt(e.target.value || "1", 10)) 
                })}
              />
            </div>
            <div>
              <Label>En</Label>
              <Input
                type="number"
                min="0"
                value={row.width || ""}
                onChange={(e) => onUpdate(row.id, { width: e.target.value })}
                placeholder="Opsiyonel"
              />
            </div>
            <div>
              <Label>Boy</Label>
              <Input
                type="number"
                min="0"
                value={row.height || ""}
                onChange={(e) => onUpdate(row.id, { height: e.target.value })}
                placeholder="Opsiyonel"
              />
            </div>
          </div>

          <div>
            <Label>Depo</Label>
            <Select
              options={warehouseOptions}
              value={row.warehouse_id || ""}
              placeholder="Seçiniz"
              onChange={handleWarehouseChange}
            />
          </div>

          <div>
            <Label>Lokasyon</Label>
            <Select
              options={locationOptions}
              value={row.location_id || ""}
              placeholder="Seçiniz"
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

      {/* Desktop: Grid Layout */}
      <div className="hidden md:grid md:grid-cols-[3fr_minmax(72px,0.45fr)_minmax(96px,0.55fr)_minmax(96px,0.55fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(90px,0.4fr)] md:items-end md:gap-4">
        {/* Display Label */}
        <div
          className="pr-2 text-sm font-medium text-gray-700 dark:text-gray-200"
          title={row.display_label}
          style={{
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {row.display_label}
        </div>

        {/* Quantity */}
        <div>
          <Label>Adet</Label>
          <Input
            type="number"
            min="1"
            className="w-16 text-center"
            value={String(row.qty)}
            onChange={(e) => onUpdate(row.id, { 
              qty: Math.max(1, parseInt(e.target.value || "1", 10)) 
            })}
          />
        </div>

        {/* Width */}
        <div>
          <Label>En</Label>
          <Input
            type="number"
            min="0"
            className="w-24"
            value={row.width || ""}
            onChange={(e) => onUpdate(row.id, { width: e.target.value })}
            placeholder="Opsiyonel"
          />
        </div>

        {/* Height */}
        <div>
          <Label>Boy</Label>
          <Input
            type="number"
            min="0"
            className="w-24"
            value={row.height || ""}
            onChange={(e) => onUpdate(row.id, { height: e.target.value })}
            placeholder="Opsiyonel"
          />
        </div>

        {/* Warehouse */}
        <div>
          <Label>Depo</Label>
          <Select
            options={warehouseOptions}
            value={row.warehouse_id || ""}
            placeholder="Seçiniz"
            onChange={handleWarehouseChange}
          />
        </div>

        {/* Location */}
        <div>
          <Label>Lokasyon</Label>
          <Select
            options={locationOptions}
            value={row.location_id || ""}
            placeholder="Seçiniz"
            onChange={(val: string) => onUpdate(row.id, { location_id: val })}
          />
        </div>

        {/* Invoice */}
        <div>
          <Label>Fatura No</Label>
          <Input
            type="text"
            value={row.invoice_no || ""}
            onChange={(e) => onUpdate(row.id, { invoice_no: e.target.value })}
            placeholder="Opsiyonel"
          />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => onClone(row.id)}
          >
            <span title="Klonla" aria-hidden>+</span>
            <span className="sr-only">Klonla</span>
          </Button>

          <Button
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => onDelete(row.id)}
          >
            <span title="Sil" aria-hidden>-</span>
            <span className="sr-only">Sil</span>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ============= MAIN COMPONENT ============= */
export default function StockEntry() {
  const location = useLocation();
  const preset = (location.state || {}) as {
    categoryName?: string;
    typeId?: string;
    masterId?: string;
  };

  // Lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [mastersRaw, setMastersRaw] = useState<Master[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});

  // Selections
  const [categoryName, setCategoryName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const [masterSearch, setMasterSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Rows & Global Settings
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

  // Initial data load
  useEffect(() => {
    Promise.all([
      api.get("/lookups/categories"),
      api.get("/lookups/warehouses"),
      api.get("/masters")
    ]).then(([categoriesRes, warehousesRes, mastersRes]) => {
      setCategories(categoriesRes.data);
      setWarehouses(warehousesRes.data);
      setMastersRaw(mastersRes.data || []);
    });
  }, []);

  // Apply preset
  useEffect(() => {
    if (preset.categoryName) {
      setCategoryName(preset.categoryName);
    }
  }, [preset.categoryName]);

  // Load types and masters when category changes
  useEffect(() => {
    setTypeId("");
    const category = categories.find(c => c.name === categoryName);
    
    if (!category) {
      setTypes([]);
      api.get("/masters").then(r => setMastersRaw(r.data || []));
      return;
    }

    Promise.all([
      api.get(`/lookups/types/${category.id}`),
      api.get(`/masters?categoryId=${category.id}`)
    ]).then(([typesRes, mastersRes]) => {
      setTypes(typesRes.data || []);
      setMastersRaw(mastersRes.data || []);
    });
  }, [categoryName, categories]);

  // Load masters when type changes
  useEffect(() => {
    const category = categories.find(c => c.name === categoryName);
    
    if (!typeId) {
      const endpoint = category 
        ? `/masters?categoryId=${category.id}`
        : "/masters";
      api.get(endpoint).then(r => setMastersRaw(r.data || []));
      return;
    }

    if (category) {
      api.get(`/masters?categoryId=${category.id}&typeId=${typeId}`)
        .then(r => setMastersRaw(r.data || []))
        .catch(() => {
          setMastersRaw(prev => prev.filter(m => 
            (m.type_id && Number(m.type_id) === Number(typeId)) ||
            (!m.type_id && m.type_name && 
             types.find(t => t.id === Number(typeId))?.name === m.type_name)
          ));
        });
    }
  }, [typeId, categoryName, categories, types]);

  // Apply preset master
  useEffect(() => {
    if (!preset.masterId) return;
    const exists = mastersRaw.find(m => String(m.id) === String(preset.masterId));
    if (exists) {
      setSelectedMasterIds(prev => Array.from(new Set([...prev, String(exists.id)])));
    }
  }, [mastersRaw, preset.masterId]);

  // Computed values
  const filteredMasters = useMemo(() => {
    if (!typeId) return mastersRaw;
    const idNum = Number(typeId);
    return mastersRaw.filter(m =>
      (m.type_id && Number(m.type_id) === idNum) ||
      (!m.type_id && m.type_name && types.find(t => t.id === idNum)?.name === m.type_name)
    );
  }, [mastersRaw, typeId, types]);

  const masterOptions = useMemo(
    () => filteredMasters.map(m => createSelectOption(m.id, m.display_label || `#${m.id}`)),
    [filteredMasters]
  );

  const warehouseOptions = useMemo(
    () => [EMPTY_SELECT_OPTION, ...warehouses.map(w => createSelectOption(w.id, w.name))],
    [warehouses]
  );

  const globalLocationOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...(globalSettings.warehouse 
        ? (locationsByWarehouse[Number(globalSettings.warehouse)] || [])
        : []
      ).map(l => createSelectOption(l.id, l.name))
    ],
    [globalSettings.warehouse, locationsByWarehouse]
  );

  const filteredForPanel = useMemo(
    () => masterOptions.filter(o => 
      o.label.toLowerCase().includes(masterSearch.toLowerCase())
    ),
    [masterOptions, masterSearch]
  );

  const isStockSaveEnabled = rows.length > 0 && 
    rows.every(r => Number(r.qty) >= 1 && r.warehouse_id && r.location_id);

  // Handlers
  const ensureLocations = useCallback(async (warehouseId: string | number): Promise<Location[]> => {
    const id = Number(warehouseId);
    if (!id) return [];

    if (locationsByWarehouse[id]) return locationsByWarehouse[id];

    const res = await api.get(`/lookups/locations?warehouseId=${id}`);
    const list: Location[] = res.data || [];
    setLocationsByWarehouse(prev => ({ ...prev, [id]: list }));
    return list;
  }, [locationsByWarehouse]);

  const showAlert = useCallback((alert: AlertState) => {
    setUiAlert(alert);
    setTimeout(() => {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const handleApplySelections = useCallback(() => {
    const currentMasterIds = new Set(rows.map(r => String(r.master_id)));
    const toAdd = selectedMasterIds.filter(id => !currentMasterIds.has(id));
    
    const newRows: Row[] = toAdd.map(id => {
      const master = filteredMasters.find(m => String(m.id) === id)!;
      return {
        id: uid(),
        master_id: master.id,
        display_label: master.display_label || `#${master.id}`,
        qty: 1,
        width: "",
        height: "",
        warehouse_id: "",
        location_id: "",
        invoice_no: globalSettings.invoice || "",
      };
    });

    const mastersToKeep = new Set(selectedMasterIds);
    const rowsAfterRemoval = rows.filter(r => mastersToKeep.has(String(r.master_id)));

    const removedCount = rows.length - rowsAfterRemoval.length;
    if (removedCount > 0) {
      const ok = confirm(`${removedCount} satır kaldırılacak. Devam edilsin mi?`);
      if (!ok) return;
    }

    setRows([...rowsAfterRemoval, ...newRows]);
    setTimeout(() => {
      rowsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, [rows, selectedMasterIds, filteredMasters, globalSettings.invoice]);

  const updateRow = useCallback((id: string, updates: Partial<Row>) => {
    setRows(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
  }, []);

  const cloneRow = useCallback((rowId: string) => {
    setRows(prev => {
      const idx = prev.findIndex(x => x.id === rowId);
      if (idx === -1) return prev;
      
      const original = prev[idx];
      const copy: Row = { ...original, id: uid(), qty: 1 };
      
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    setRows(prev => prev.filter(r => r.id !== rowId));
  }, []);

  const applyGlobalsToAll = useCallback(async () => {
    let nextRows = [...rows];

    if (globalSettings.warehouse) {
      const locs = await ensureLocations(globalSettings.warehouse);
      const firstLocId = globalSettings.location || String(locs[0]?.id || "");

      nextRows = nextRows.map(r => ({
        ...r,
        warehouse_id: globalSettings.warehouse,
        location_id: firstLocId,
      }));

      if (!globalSettings.location) {
        setGlobalSettings(prev => ({ ...prev, location: firstLocId }));
      }
    }

    nextRows = nextRows.map(r => ({
      ...r,
      invoice_no: globalSettings.invoice,
    }));

    setRows(nextRows);
  }, [rows, globalSettings, ensureLocations]);

  const handleSave = useCallback(async () => {
    try {
      if (!rows.length) {
        showAlert({
          variant: "warning",
          title: "Eksik bilgi",
          message: "Önce tanım seçip satır oluşturun.",
        });
        return;
      }

      const payload: any[] = [];
      rows.forEach(r => {
        const master = mastersRaw.find(m => m.id === r.master_id);
        const unit = (master?.default_unit || "EA") as "EA" | "M" | "KG";
        
        for (let i = 0; i < Number(r.qty); i++) {
          payload.push({
            master_id: r.master_id,
            unit,
            quantity: 1,
            warehouse_id: Number(r.warehouse_id),
            location_id: Number(r.location_id),
            width: r.width ? Number(r.width) : undefined,
            height: r.height ? Number(r.height) : undefined,
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

      setTimeout(() => {
        alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);

      setRows([]);
    } catch (err: any) {
      console.error("Stok kaydı hatası:", err);
      const { status, data } = err?.response || {};

      if (status === 400 && data?.errors?.length) {
        const msg = data.errors
          .map((e: any) => `• Satır ${e.index + 1} - ${e.field}: ${e.message}`)
          .join("\n");

        showAlert({
          variant: "error",
          title: "Validasyon hatası",
          message: msg,
        });
        return;
      }

      showAlert({
        variant: "error",
        title: "Beklenmeyen hata",
        message: "Stok kaydı sırasında bir sorun oluştu.",
      });
    }
  }, [rows, mastersRaw, showAlert]);

  const handleGlobalWarehouseChange = useCallback(async (val: string) => {
    setGlobalSettings(prev => ({ ...prev, warehouse: val }));
    const locs = await ensureLocations(val);
    const firstLoc = String(locs[0]?.id || "");
    setGlobalSettings(prev => ({ ...prev, location: firstLoc }));
  }, [ensureLocations]);

  const categoryOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...categories.map(c => createSelectOption(c.name, c.name))
    ],
    [categories]
  );

  const typeOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...types.map(t => createSelectOption(t.id, t.name))
    ],
    [types]
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title="Stok Girişi"
        description="Tanım seç + yeni tanım ekle + satırlardan stok girişi"
      />
      <PageBreadcrumb pageTitle="Stok Girişi" />

      {/* Card #1: Master Selection */}
      <ComponentCard title="Tanım Seçimi">
        {/* Inline Master Form */}
        <details
          open={createOpen}
          onToggle={(e) => setCreateOpen((e.target as HTMLDetailsElement).open)}
          className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white">
            Yeni Tanım Ekle
          </summary>

          <div className="mt-4">
            <MasterInlineForm
              onSaved={(m) => {
                setSelectedMasterIds(prev =>
                  Array.from(new Set([...prev, String(m.id)]))
                );
                setMastersRaw(prev => [
                  { id: m.id, display_label: m.display_label || `#${m.id}` },
                  ...prev,
                ]);
              }}
              onCancel={() => setCreateOpen(false)}
            />
          </div>
        </details>

        {/* Category / Type Filters */}
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Kategori</Label>
            <Select
              options={categoryOptions}
              value={categoryName}
              placeholder="Tümü"
              onChange={setCategoryName}
            />
          </div>
          <div>
            <Label>Tür</Label>
            <Select
              options={typeOptions}
              value={typeId}
              placeholder="Tümü"
              onChange={setTypeId}
            />
          </div>
        </div>

        {/* Multi-select Panel */}
        <div className="mt-4">
          <Label>Tanım Seçimi (çoklu)</Label>
          <div className="mt-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
            <div className="mb-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <Input
                type="text"
                placeholder="Ara..."
                value={masterSearch}
                onChange={(e) => setMasterSearch(e.target.value)}
              />
              <div className="flex items-center justify-end gap-2">
                <Button variant="outline" onClick={() => setSelectedMasterIds([])}>
                  Seçimleri Temizle
                </Button>
              </div>
            </div>

            <div className="max-h-32 overflow-auto pr-1">
              {filteredForPanel.length === 0 ? (
                <div className="py-6 text-sm text-gray-500">Kayıt bulunamadı.</div>
              ) : (
                <ul className="space-y-1">
                  {filteredForPanel.map(o => {
                    const checked = selectedMasterIds.includes(o.value);
                    return (
                      <li
                        key={o.value}
                        className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                      >
                        <label className="flex cursor-pointer items-center gap-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const on = e.target.checked;
                              setSelectedMasterIds(prev =>
                                on
                                  ? Array.from(new Set([...prev, o.value]))
                                  : prev.filter(x => x !== o.value)
                              );
                            }}
                          />
                          <span className="text-sm text-gray-700 dark:text-gray-200">
                            {o.label}
                          </span>
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

      {/* Card #2: Stock Entry Rows */}
      {rows.length > 0 && (
        <ComponentCard title="Stok Girişi">
          <div ref={rowsSectionRef} />
          
          {/* Global Settings Toolbar */}
          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <Label>Fatura No</Label>
              <Input
                type="text"
                value={globalSettings.invoice}
                onChange={(e) => setGlobalSettings(prev => ({ 
                  ...prev, 
                  invoice: e.target.value 
                }))}
                placeholder="Opsiyonel"
              />
            </div>
            <div>
              <Label>Varsayılan Depo</Label>
              <Select
                options={warehouseOptions}
                value={globalSettings.warehouse}
                placeholder="Seçiniz"
                onChange={handleGlobalWarehouseChange}
              />
            </div>
            <div>
              <Label>Varsayılan Lokasyon</Label>
              <Select
                options={globalLocationOptions}
                value={globalSettings.location}
                placeholder="Seçiniz"
                onChange={(val: string) => setGlobalSettings(prev => ({ 
                  ...prev, 
                  location: val 
                }))}
              />
            </div>
            <div className="flex justify-end md:justify-start">
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={applyGlobalsToAll}
              >
                Tümüne Uygula
              </Button>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-gray-200 dark:bg-gray-700" />

          {/* Rows */}
          <div className="space-y-4">
            {rows.map(row => (
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
              onClick={handleSave}
              disabled={!isStockSaveEnabled}
            >
              Stok Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}

      {/* Alert Area */}
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