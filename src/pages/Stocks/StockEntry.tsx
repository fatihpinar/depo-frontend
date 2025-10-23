// src/pages/Stock/StockEntry.tsx
// Birleşik sayfa (v2) — okunabilirlik için satır içi uzun ifadeler
// dikeyde bölündü; davranış aynıdır.

import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";

/* UI */
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";

/* ---------------- Types ---------------- */
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

/*
const UNIT_LABEL: Record<string, string> = {
  EA: "Adet",
  M: "Uzunluk",
  KG: "Ağırlık",
}; */
const uid = () => Math.random().toString(36).slice(2);

/* =========================================================
   Inline Master Form (supplier_lot_no yok)
========================================================= */
function FieldRenderer({
  field,
  value,
  onChange,
  disabled,
  selectOptions,
}: {
  field: FieldDef;
  value: any;
  onChange: (v: any) => void;
  disabled?: boolean;
  selectOptions?: { value: string; label: string }[];
}) {
  const req = field.required ? " *" : "";
  const suffix = field.unitSuffix ? (
    <span className="ml-2 text-xs text-gray-500">{field.unitSuffix}</span>
  ) : null;

  if (field.kind === "select") {
    return (
      <div>
        <Label>
          {field.label}
          {req}
        </Label>

        <Select
          options={[
            { value: "", label: "Seçiniz", disabled: true } as any,
            ...((selectOptions || []).map((o) => ({
              value: String(o.value),
              label: o.label,
            })) as any),
          ]}
          value={value === undefined || value === null ? "" : String(value)}
          onChange={(v: string) => onChange(v)}
          placeholder="Seçiniz"
          className={disabled ? "opacity-60 pointer-events-none" : ""}
        />
      </div>
    );
  }

  if (field.kind === "number") {
    return (
      <div>
        <Label>
          {field.label}
          {req}
        </Label>

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
      <Label>
        {field.label}
        {req}
      </Label>

      <Input
        type="text"
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      />
    </div>
  );
}

function MasterInlineForm({
  onSaved,
  onCancel,
}: {
  onSaved: (saved: {
    id: number;
    display_label: string;
    type_id?: number;
  }) => void;
  onCancel?: () => void;
}) {
  const [schema, setSchema] = useState<Schema | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [suppliers, setSuppliers] = useState<{ id: number; name: string }[]>(
    []
  );

  const [categoryName, setCategoryName] = useState<string>("");
  const [baseValues, setBaseValues] = useState<Record<string, any>>({});
  const [categoryValues, setCategoryValues] = useState<Record<string, any>>({});
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [saving, setSaving] = useState(false);

  /* ---- effects ---- */
  useEffect(() => {
    api.get("/lookups/master-field-schema").then((r) => setSchema(r.data));
    api.get("/lookups/categories").then((r) => setCategories(r.data));
    api.get("/lookups/suppliers").then((r) => setSuppliers(r.data));
  }, []);

  useEffect(() => {
    const cat = categories.find((c) => c.name === categoryName);

    if (!cat) {
      setTypes([]);
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      return;
    }

    api.get(`/lookups/types/${cat.id}`).then((r) => setTypes(r.data));

    setBaseValues({});
    setCategoryValues({});
    setAddingSupplier(false);
    setNewSupplierName("");
  }, [categoryName, categories]);

  /* ---- memo & helpers ---- */
  const categoryKey = useMemo(() => {
    if (!schema || !categoryName) return null;

    const byName = schema.categoryMapByName || {};
    return (
      byName[categoryName] ||
      Object.entries(byName).find(
        ([n]) => n.toUpperCase() === categoryName.toUpperCase()
      )?.[1] ||
      null
    );
  }, [schema, categoryName]);

  const categoryFields: FieldDef[] = useMemo(
    () => (categoryKey && schema ? schema.categoryFields[categoryKey] || [] : []),
    [schema, categoryKey]
  );

  const getBaseFieldDef = (key: string): FieldDef | undefined =>
    schema?.baseFields.find((f) => f.key === key);

  const typeOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true } as any,
      ...types.map((t) => ({ value: String(t.id), label: t.name })),
    ],
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true } as any,
      ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
      { value: "new", label: "+ Yeni Tedarikçi Ekle" },
    ],
    [suppliers]
  );

  const baseSelectSources: Record<string, { value: string; label: string }[]> =
    useMemo(
      () => ({
        type_id: typeOptions,
        supplier_id: supplierOptions,
      }),
      [typeOptions, supplierOptions]
    );

  const updateBase = (key: string, v: any) => {
    if (key === "supplier_id") {
      if (v === "new") {
        setAddingSupplier(true);
        setBaseValues((p) => ({ ...p, supplier_id: "" }));
      } else {
        setAddingSupplier(false);
        setNewSupplierName("");
        setBaseValues((p) => ({ ...p, supplier_id: v }));
      }
      return;
    }
    setBaseValues((p) => ({ ...p, [key]: v }));
  };

  const updateCat = (key: string, v: any) =>
    setCategoryValues((p) => ({ ...p, [key]: v }));

  const renderBase = (key: string) => {
    const f = getBaseFieldDef(key);
    if (!f) return null;

    const selectOptions =
      f.kind === "select"
        ? f.options?.map((o) => ({ value: String(o.value), label: o.label })) ||
          baseSelectSources[f.key] ||
          []
        : undefined;

    return (
      <FieldRenderer
        field={f}
        value={baseValues[f.key]}
        onChange={(v) => updateBase(f.key, v)}
        selectOptions={selectOptions}
      />
    );
  };

  const categoryOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  /* ---- save ---- */
  const handleSave = async () => {
    if (!schema) return;

    const cat = categories.find((c) => c.name === categoryName);
    if (!cat) {
      alert("Kategori seçiniz.");
      return;
    }

    // required kontrolü
    const misses: string[] = [];

    schema.baseFields.forEach((f) => {
      if (!f.required) return;
      const v = baseValues[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        misses.push(f.label);
      }
    });

    categoryFields.forEach((f) => {
      if (!f.required) return;
      const v = categoryValues[f.key];
      if (v === undefined || v === null || String(v).trim() === "") {
        misses.push(f.label);
      }
    });

    if (misses.length) {
      alert("Zorunlu alan(lar) eksik:\n- " + misses.join("\n- "));
      return;
    }

    setSaving(true);
    try {
      // Yeni tedarikçi gerekiyorsa
      let supplierId: number | null = null;

      if (addingSupplier) {
        const name = (newSupplierName || "").trim();
        if (!name) {
          alert("Yeni tedarikçi adını yazınız.");
          setSaving(false);
          return;
        }

        const exists = suppliers.find(
          (s) => (s.name || "").toLowerCase() === name.toLowerCase()
        );

        if (exists) {
          supplierId = exists.id;
        } else {
          const supRes = await api.post("/lookups/suppliers", { name });
          supplierId = supRes.data.id;
          setSuppliers((prev) => [...prev, supRes.data]);
        }
      }

      // payload
      const payload: Record<string, any> = { category_id: cat.id };

      schema.baseFields.forEach((f) => {
        let val = baseValues[f.key] ?? null;
        if (f.key === "supplier_id" && addingSupplier) {
          val = supplierId;
        }
        payload[f.key] = val;
      });

      categoryFields
        .filter((f) => f.key !== "supplier_lot_no")
        .forEach((f) => {
          payload[f.key] = categoryValues[f.key] ?? null;
        });

      const res = await api.post("/masters", payload);

      alert("Tanım kaydedildi.");
      onSaved({
        id: res.data.id,
        display_label: res.data.display_label,
        type_id: res.data.type_id,
      });

      // formu sıfırla + paneli kapat
      setCategoryName("");
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      onCancel?.();
    } catch (err: any) {
      console.error("Master kaydetme hatası:", err);
      const status = err?.response?.status;
      const data = err?.response?.data;

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

  /* ---- UI ---- */
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Kategori</Label>
          <Select
            options={categoryOptions}
            value={categoryName}
            onChange={(v: string) => setCategoryName(v)}
            placeholder="Seçiniz"
          />
        </div>

        <div>{renderBase("type_id")}</div>

        <div>
          {renderBase("supplier_id")}

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

        <div>{renderBase("supplier_product_code")}</div>
        <div>{renderBase("bimeks_code")}</div>
      </div>

      <div className="mt-4">
        <h3 className="mb-2 text-sm font-semibold text-gray-800 dark:text-gray-100">
          Kategoriye Özel Alanlar
        </h3>

        {categoryFields.filter((f) => f.key !== "supplier_lot_no").length === 0 ? (
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Bu kategori için ek alan yok.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {categoryFields
              .filter((f) => f.key !== "supplier_lot_no")
              .map((cf) => (
                <div key={cf.key}>
                  <FieldRenderer
                    field={cf}
                    value={categoryValues[cf.key]}
                    onChange={(v) => updateCat(cf.key, v)}
                    selectOptions={
                      cf.kind === "select"
                        ? (cf.options || []).map((o) => ({
                            value: String(o.value),
                            label: o.label,
                          }))
                        : undefined
                    }
                  />
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-2 flex gap-3">
        <Button
          variant="primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>

        <Button
          variant="outline"
          onClick={() => onCancel?.()}
        >
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* =========================================================
   Ana Sayfa
========================================================= */
export default function StockEntry() {
  const location = useLocation() as any;
  const preset = (location.state || {}) as {
    categoryName?: string;
    typeId?: string;
    masterId?: string;
  };

  /* lookups */
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [mastersRaw, setMastersRaw] = useState<Master[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] =
    useState<Record<number, Location[]>>({});

  /* seçimler */
  const [categoryName, setCategoryName] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");

  // multi-select & inline create
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  /* satırlar */
  const [rows, setRows] = useState<Row[]>([]);
  const [globalInvoice, setGlobalInvoice] = useState<string>("");
  const [globalWarehouse, setGlobalWarehouse] = useState<string>("");
  const [globalLocation, setGlobalLocation] = useState<string>("");

  /* alert */
  const [uiAlert, setUiAlert] = useState<{
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  } | null>(null);
  // refs
  const rowsSectionRef = useRef<HTMLDivElement | null>(null); // satırların başı (bunu zaten eklemiştik)
  const alertRef = useRef<HTMLDivElement | null>(null);       // UYARI alanı (kartın altı)


  const showAlert = (a: {
    variant: "success" | "error" | "warning" | "info";
    title: string;
    message: string;
  }) => {
    setUiAlert(a);
    // uyarı alanına yumuşak kaydır
    setTimeout(() => {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  /* ---- load ---- */
  useEffect(() => {
    api.get("/lookups/categories").then((r) => setCategories(r.data));
    api.get("/lookups/warehouses").then((r) => setWarehouses(r.data));
    api.get("/masters").then((r) => setMastersRaw(r.data || []));
  }, []);

  useEffect(() => {
    if (preset.categoryName) setCategoryName(preset.categoryName);
  }, [preset.categoryName]);

  useEffect(() => {
    setTypeId("");

    const cat = categories.find((c) => c.name === categoryName);
    if (!cat) {
      setTypes([]);
      api.get("/masters").then((r) => setMastersRaw(r.data || []));
      return;
    }

    api.get(`/lookups/types/${cat.id}`).then((r) => setTypes(r.data || []));
    api.get(`/masters?categoryId=${cat.id}`).then((r) => setMastersRaw(r.data || []));
  }, [categoryName, categories]);

  useEffect(() => {
    const cat = categories.find((c) => c.name === categoryName);

    if (!typeId) {
      if (!cat) {
        api.get("/masters").then((r) => setMastersRaw(r.data || []));
      } else {
        api.get(`/masters?categoryId=${cat.id}`).then((r) => setMastersRaw(r.data || []));
      }
      return;
    }

    if (cat) {
      api
        .get(`/masters?categoryId=${cat.id}&typeId=${typeId}`)
        .then((r) => setMastersRaw(r.data || []))
        .catch(() => {
          setMastersRaw((prev) =>
            prev.filter(
              (m) =>
                (m.type_id && Number(m.type_id) === Number(typeId)) ||
                (!m.type_id &&
                  m.type_name &&
                  types.find((t) => t.id === Number(typeId))?.name === m.type_name)
            )
          );
        });
    }
  }, [typeId, categoryName, categories, types]);

  useEffect(() => {
    if (!preset.masterId) return;

    const exists = mastersRaw.find(
      (m) => String(m.id) === String(preset.masterId)
    );
    if (exists) {
      setSelectedMasterIds((prev) =>
        Array.from(new Set([...prev, String(exists.id)]))
      );
    }
  }, [mastersRaw, preset.masterId]);

  /* ---- helpers ---- */
  const ensureLocations = async (warehouseId: string | number) => {
    const id = Number(warehouseId);
    if (!id) return [] as Location[];

    if (locationsByWarehouse[id]) return locationsByWarehouse[id];

    const res = await api.get(`/lookups/locations?warehouseId=${id}`);
    const list: Location[] = res.data || [];
    setLocationsByWarehouse((prev) => ({ ...prev, [id]: list }));
    return list;
  };

  const filteredMasters = useMemo(() => {
    if (!typeId) return mastersRaw;

    const idNum = Number(typeId);
    return mastersRaw.filter(
      (m) =>
        (m.type_id && Number(m.type_id) === idNum) ||
        (!m.type_id &&
          m.type_name &&
          types.find((t) => t.id === idNum)?.name === m.type_name)
    );
  }, [mastersRaw, typeId, types]);

  const masterOptions = useMemo(
    () =>
      filteredMasters.map((m) => ({
        value: String(m.id),
        label: m.display_label || `#${m.id}`,
      })),
    [filteredMasters]
  );

  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true } as any,
      ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [warehouses]
  );

  const globalLocationOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true } as any,
      ...(
        globalWarehouse
          ? (locationsByWarehouse[Number(globalWarehouse)] || [])
          : []
      ).map((l) => ({ value: String(l.id), label: l.name })),
    ],
    [globalWarehouse, locationsByWarehouse]
  );

  const [masterSearch, setMasterSearch] = useState("");

  const filteredForPanel = useMemo(
    () =>
      masterOptions.filter((o) =>
        (o.label || "")
          .toLowerCase()
          .includes((masterSearch || "").toLowerCase())
      ),
    [masterOptions, masterSearch]
  );

  // --- handleApplySelections: satırlar eklendi info alert'ini kaldır + scroll ekle ---
  const handleApplySelections = () => {
    const currentMasterIds = new Set(rows.map((r) => String(r.master_id)));

    const toAdd = selectedMasterIds.filter((id) => !currentMasterIds.has(id));
    const newRows: Row[] = toAdd.map((id) => {
      const mm = filteredMasters.find((m) => String(m.id) === id)!;
      return {
        id: uid(),
        master_id: mm.id,
        display_label: mm.display_label || `#${mm.id}`,
        qty: 1,
        width: "",
        height: "",
        warehouse_id: "",
        location_id: "",
        invoice_no: globalInvoice || "",
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

    // 👇 info alert YOK; bunun yerine satırların başına scroll
    setTimeout(() => {
      rowsSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  };

  // mevcut cloneRow'u bununla değiştir
  const cloneRow = (rowId: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((x) => x.id === rowId);
      if (idx === -1) return prev; // bulunamazsa dokunma

      const original = prev[idx];
      const copy: Row = { ...original, id: uid(), qty: 1 }; // id yeni, qty 1

      const next = [...prev];
      next.splice(idx + 1, 0, copy); // tam altına ekle
      return next;
    });
  };

  const deleteRow = (rowId: string) =>
    setRows((prev) => prev.filter((r) => r.id !== rowId));

  const applyGlobalsToAll = async () => {
    let nextRows = [...rows];

    if (globalWarehouse) {
      const locs = await ensureLocations(globalWarehouse);
      const firstLocId =
        globalLocation || String(locs[0]?.id || "");

      nextRows = nextRows.map((r) => ({
        ...r,
        warehouse_id: globalWarehouse,
        location_id: firstLocId,
      }));

      if (!globalLocation) {
        setGlobalLocation(firstLocId);
      }
    }

    nextRows = nextRows.map((r) => ({
      ...r,
      invoice_no: globalInvoice,
    }));

    setRows(nextRows);
  };

  const isStockSaveEnabled =
    rows.length > 0 &&
    rows.every(
      (r) => Number(r.qty) >= 1 && r.warehouse_id && r.location_id
    );

  const handleSave = async () => {
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
      rows.forEach((r) => {
        const m = mastersRaw.find((mm) => mm.id === r.master_id);
        const unit = (m?.default_unit || "EA") as "EA" | "M" | "KG";
        for (let i = 0; i < Number(r.qty); i++) {
          payload.push({
            master_id: r.master_id,
            unit,
            quantity: 1,
            warehouse_id: Number(r.warehouse_id),
            location_id: Number(r.location_id),
            width: r.width ? Number(r.width) : undefined,
            height: r.height ? Number(r.height) : undefined,
            invoice_no: r.invoice_no?.trim() ? r.invoice_no.trim() : null,
          });
        }
      });

      const res = await api.post("/components/bulk", payload);

      showAlert({
        variant: "success",
        title: "Stok kaydı tamamlandı",
        message: `${res?.data?.length ?? payload.length} kayıt eklendi.`,
      });

      // 👇 en üste scroll
      setTimeout(() => {
        alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 0);

      setRows([]);
    } catch (err: any) {
      console.error("Stok kaydı hatası:", err);
      const status = err?.response?.status;
      const data = err?.response?.data;

      if (status === 400 && data?.errors?.length) {
        const msg = data.errors
          .map(
            (e: any) => `• Satır ${e.index + 1} - ${e.field}: ${e.message}`
          )
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
  };

  const categoryOptions = [
    { value: "", label: "Tümü" },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  const typeOptions = [
    { value: "", label: "Tümü" },
    ...types.map((t) => ({ value: String(t.id), label: t.name })),
  ];


  return (
  <div className="space-y-6">
    <PageMeta
      title="Stok Girişi"
      description="Tanım seç + yeni tanım ekle + satırlardan stok girişi"
    />
    <PageBreadcrumb pageTitle="Stok Girişi" />

    {/* Card #1: Tanım / Master */}
    <ComponentCard title="Tanım Seçimi">
      {/* Inline Yeni Tanım */}
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
              setSelectedMasterIds((prev) =>
                Array.from(new Set([...prev, String(m.id)])),
              );
              setMastersRaw((prev) => [
                { id: m.id, display_label: m.display_label || `#${m.id}` },
                ...prev,
              ]);
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </div>
      </details>

      {/* Kategori / Tür */}
      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>Kategori</Label>
          <Select
            options={categoryOptions}
            value={categoryName}
            placeholder="Tümü"
            onChange={(val: string) => setCategoryName(val)}
          />
        </div>
        <div>
          <Label>Tür</Label>
          <Select
            options={typeOptions}
            value={typeId}
            placeholder="Tümü"
            onChange={(val: string) => setTypeId(val)}
          />
        </div>
      </div>

      {/* Multi-select */}
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
                {filteredForPanel.map((o) => {
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
                            setSelectedMasterIds((prev) =>
                              on
                                ? Array.from(new Set([...prev, o.value]))
                                : prev.filter((x) => x !== o.value),
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

    {/* Card: Satırlar */}
    {rows.length > 0 && (
      <ComponentCard title="Stok Girişi">
        {/* 👇 satırların başladığı anchor */}
    <div ref={rowsSectionRef} />
        {/* Global seçim toolbar */}
        <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <div>
            <Label>Fatura No</Label>
            <Input
              type="text"
              value={globalInvoice}
              onChange={(e) => setGlobalInvoice(e.target.value)}
              placeholder="Opsiyonel"
            />
          </div>
          <div>
            <Label>Varsayılan Depo</Label>
            <Select
              options={warehouseOptions}
              value={globalWarehouse}
              placeholder="Seçiniz"
              onChange={async (val: string) => {
                setGlobalWarehouse(val);
                const locs = await ensureLocations(val);
                const firstLoc = String(locs[0]?.id || "");
                setGlobalLocation(firstLoc);
              }}
            />
          </div>
          <div>
            <Label>Varsayılan Lokasyon</Label>
            <Select
              options={globalLocationOptions}
              value={globalLocation}
              placeholder="Seçiniz"
              onChange={(val: string) => setGlobalLocation(val)}
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

        {/* Ayraç */}
        <div className="my-4 h-px w-full bg-gray-200 dark:bg-gray-700" />

        {/* Satırlar */}
        <div className="space-y-4">
          {rows.map((r) => {
            const wh = r.warehouse_id || "";
            const locOptions = [
              { value: "", label: "Seçiniz", disabled: true } as any,
              ...((wh ? (locationsByWarehouse[Number(wh)] || []) : []).map((l) => ({
                value: String(l.id),
                label: l.name,
              }))),
            ];

            return (
              <div
                key={r.id}
                className="grid grid-cols-1 items-end gap-4 md:grid-cols-[3fr_minmax(72px,0.45fr)_minmax(96px,0.55fr)_minmax(96px,0.55fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(90px,0.4fr)]"
              >
                {/* Tanım */}
                <div
                  className="pr-2 text-sm font-medium text-gray-700 dark:text-gray-200"
                  title={r.display_label}
                  style={{
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                  }}
                >
                  {r.display_label}
                </div>

                {/* Adet */}
                <div>
                  <Label>Adet</Label>
                  <Input
                    type="number"
                    min="1"
                    className="w-16 text-center"
                    value={String(r.qty)}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id
                            ? { ...x, qty: Math.max(1, parseInt(e.target.value || "1", 10)) }
                            : x,
                        ),
                      )
                    }
                  />
                </div>

                {/* En */}
                <div>
                  <Label>En</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-24"
                    value={r.width || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, width: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Opsiyonel"
                  />
                </div>

                {/* Boy */}
                <div>
                  <Label>Boy</Label>
                  <Input
                    type="number"
                    min="0"
                    className="w-24"
                    value={r.height || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, height: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Opsiyonel"
                  />
                </div>

                {/* Depo */}
                <div>
                  <Label>Depo</Label>
                  <Select
                    options={warehouseOptions}
                    value={r.warehouse_id || ""}
                    placeholder="Seçiniz"
                    onChange={async (val: string) => {
                      const locs = await ensureLocations(val);
                      const current = r.location_id;
                      const stillOk = !!locs.find((l) => String(l.id) === String(current));
                      const nextLocId = stillOk ? current : String(locs[0]?.id || "");
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id
                            ? { ...x, warehouse_id: val, location_id: nextLocId }
                            : x,
                        ),
                      );
                    }}
                  />
                </div>

                {/* Lokasyon */}
                <div>
                  <Label>Lokasyon</Label>
                  <Select
                    options={locOptions}
                    value={r.location_id || ""}
                    placeholder="Seçiniz"
                    onChange={(val: string) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, location_id: val } : x,
                        ),
                      )
                    }
                  />
                </div>

                {/* Fatura No */}
                <div>
                  <Label>Fatura No</Label>
                  <Input
                    type="text"
                    value={r.invoice_no || ""}
                    onChange={(e) =>
                      setRows((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, invoice_no: e.target.value } : x,
                        ),
                      )
                    }
                    placeholder="Opsiyonel"
                  />
                </div>

                {/* Aksiyonlar */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    className="h-9 w-9 p-0"
                    onClick={() => cloneRow(r.id)}
                  >
                    <span title="Klonla" aria-hidden>+</span>
                    <span className="sr-only">Klonla</span>
                  </Button>
                  <Button
                    variant="outline"
                    className="h-9 w-9 p-0"
                    onClick={() => deleteRow(r.id)}
                  >
                    <span title="Sil" aria-hidden>-</span>
                    <span className="sr-only">Sil</span>
                  </Button>
                </div>
              </div>
            );
          })}
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
    {/* 👇 Kartın ALTINDA global uyarı alanı */}
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