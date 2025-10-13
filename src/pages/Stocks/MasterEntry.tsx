// src/pages/MasterEntry/MasterEntry.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";

import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

/* ---------- Tipler ---------- */
type Category = { id: number; name: string };
type TypeRow = { id: number; name: string; category_id?: number };
type Supplier = { id: number; name: string };
type Master = { id: number; display_label: string; [k: string]: any };

type FieldDef = {
  key: string;
  label: string;
  kind: "text" | "number" | "select";
  required?: boolean;
  unitSuffix?: string;
  options?: { value: string | number; label: string }[];
};

type Schema = {
  version: string | number;
  baseFields: FieldDef[];
  categoryFields: Record<string, FieldDef[]>;
  categoryMapById?: Record<string | number, string>;
  categoryMapByName?: Record<string, string>;
  categoryMap?: Record<string | number, string>;
};

/* ---------- Küçük Field Renderer ---------- */
function Field({
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
            { value: "", label: "Seçiniz", disabled: true },
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

/* =========================================================
   MASTER ENTRY (sadece tanım oluştur/seç & kaydet)
========================================================= */
export default function MasterEntry() {
  const navigate = useNavigate();

  // lookups
  const [schema, setSchema] = useState<Schema | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [masters, setMasters] = useState<Master[]>([]);

  // seçimler
  const [categoryName, setCategoryName] = useState<string>("");
  const [selectedMasterId, setSelectedMasterId] = useState<string>("");

  // form state (tamamen şemadan)
  const [baseValues, setBaseValues] = useState<Record<string, any>>({});
  const [categoryValues, setCategoryValues] = useState<Record<string, any>>({});

  // “yeni tedarikçi ekle” modu
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");

  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  // kaydet sonrası stok girişine taşıyacağımız veri
  const [lastSaved, setLastSaved] = useState<{ id: number; typeId?: string } | null>(null);

  /* --------- helpers --------- */
  const resolveCategoryKey = (name: string): string | null => {
    if (!schema || !name) return null;
    if (schema.categoryMapByName && schema.categoryMapByName[name])
      return schema.categoryMapByName[name];
    if (schema.categoryMap && (schema.categoryMap as any)[name])
      return schema.categoryMap[name] as string;
    const byName = schema.categoryMapByName || {};
    const hit = Object.entries(byName).find(
      ([n]) => n.toUpperCase() === name.toUpperCase()
    );
    return hit ? (hit[1] as string) : null;
  };

  const categoryKey = useMemo(
    () => resolveCategoryKey(categoryName),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [schema, categoryName]
  );

  const categoryFields: FieldDef[] = useMemo(
    () => (categoryKey && schema ? schema.categoryFields[categoryKey] || [] : []),
    [schema, categoryKey]
  );

  const getBaseFieldDef = (key: string): FieldDef | undefined =>
    schema?.baseFields.find((f) => f.key === key);

  /* --------- load --------- */
  useEffect(() => {
    api.get("/lookups/master-field-schema").then((r) => setSchema(r.data));
    api.get("/lookups/categories").then((r) => setCategories(r.data));
    api.get("/lookups/suppliers").then((r) => setSuppliers(r.data));
  }, []);

  // kategori -> types & masters
  useEffect(() => {
    const cat = categories.find((c) => c.name === categoryName);
    if (!cat) {
      setTypes([]);
      setMasters([]);
      setSelectedMasterId("");
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      setIsDirty(false);
      setLastSaved(null);
      return;
    }
    api.get(`/lookups/types/${cat.id}`).then((r) => setTypes(r.data));
    api.get(`masters?categoryId=${cat.id}`).then((r) => setMasters(r.data));

    setSelectedMasterId("");
    setBaseValues({});
    setCategoryValues({});
    setAddingSupplier(false);
    setNewSupplierName("");
    setIsDirty(false);
    setLastSaved(null);
  }, [categoryName, categories]);

  /* --------- select options (base alanlar için) --------- */
  const typeOptions = useMemo(
    () =>
      [{ value: "", label: "Seçiniz", disabled: true } as any].concat(
        types.map((t) => ({ value: String(t.id), label: t.name }))
      ),
    [types]
  );

  const supplierOptions = useMemo(
    () =>
      [{ value: "", label: "Seçiniz", disabled: true } as any]
        .concat(suppliers.map((s) => ({ value: String(s.id), label: s.name })))
        .concat([{ value: "new", label: "+ Yeni Tedarikçi Ekle" }]),
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

  /* --------- master seçimi --------- */
  const handleMasterSelect = (val: string) => {
    setSelectedMasterId(val);
    if (!val) {
      setBaseValues({});
      setCategoryValues({});
      setAddingSupplier(false);
      setNewSupplierName("");
      setIsDirty(false);
      setLastSaved(null);
      return;
    }
    const m = masters.find((mm) => String(mm.id) === String(val));
    if (!m) return;

    // şemaya göre hydrate
    const bv: Record<string, any> = {};
    schema?.baseFields.forEach((f) => (bv[f.key] = m[f.key] ?? ""));
    const cv: Record<string, any> = {};
    categoryFields.forEach((f) => (cv[f.key] = m[f.key] ?? ""));

    setAddingSupplier(false);
    setNewSupplierName("");

    setBaseValues(bv);
    setCategoryValues(cv);
    setIsDirty(false);
    setLastSaved(null);
  };

  /* --------- alan değişimleri --------- */
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
      setIsDirty(true);
      return;
    }
    setBaseValues((p) => ({ ...p, [key]: v }));
    setIsDirty(true);
  };

  const updateCat = (key: string, v: any) => {
    setCategoryValues((p) => ({ ...p, [key]: v }));
    setIsDirty(true);
  };

  /* --------- kaydet --------- */
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
      // yeni tedarikçi gerekiyorsa oluştur
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
      categoryFields.forEach((f) => {
        payload[f.key] = categoryValues[f.key] ?? null;
      });

      const res = await api.post("/masters", payload);
      setMasters((prev) => [res.data, ...prev]);
      setSelectedMasterId(String(res.data.id));
      setIsDirty(false);
      setAddingSupplier(false);
      setNewSupplierName("");
      setLastSaved({
        id: res.data.id,
        typeId: baseValues["type_id"] ? String(baseValues["type_id"]) : undefined,
      });
      alert("Tanım kaydedildi.");
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

  /* --------- options --------- */
  const categoryOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];

  // base alan render helper (şemaya göre)
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
      <Field
        field={f}
        value={baseValues[f.key]}
        onChange={(v) => updateBase(f.key, v)}
        selectOptions={selectOptions}
      />
    );
  };

  /* --------- UI --------- */
  return (
    <div className="space-y-6">
      <PageMeta title="Tanım Girişi" description="Master tanımlarını oluştur / düzenle" />
      <PageBreadcrumb pageTitle="Tanım Girişi" />

      <ComponentCard title="Tanım / Master">
        {/* 1) Kategori + Tür */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Kategori</Label>
            <Select
              options={categoryOptions}
              value={categoryName}
              onChange={(v: string) => {
                setCategoryName(v);
                setIsDirty(true);
              }}
              placeholder="Seçiniz"
            />
          </div>
          <div>{renderBase("type_id")}</div>

          {/* 2) Tanım Seçimi (tam satır) */}
          <div className="md:col-span-2">
            <Label>Tanım Seçimi</Label>
            <Select
              options={[
                { value: "", label: "Seçiniz / Yeni Tanım Ekle", disabled: true },
                ...masters.map((m) => ({ value: String(m.id), label: m.display_label })),
              ]}
              value={selectedMasterId}
              onChange={handleMasterSelect}
              placeholder="Seçiniz / Yeni Tanım Ekle"
            />
          </div>

          {/* 3) Tedarikçi + Tedarikçi Ürün Kodu */}
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

          {/* 4) Tedarikçi Lot No + Bimeks Kodu */}
          <div>{renderBase("supplier_lot_no")}</div>
          <div>{renderBase("bimeks_code")}</div>
        </div>

        {/* Kategoriye özel alanlar */}
        <div className="mt-8">
          <h3 className="mb-3 text-sm font-semibold text-gray-800 dark:text-gray-100">
            Kategoriye Özel Alanlar
          </h3>
          {categoryFields.length === 0 ? (
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Bu kategori için ek alan yok.
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {categoryFields.map((cf) => (
                <div key={cf.key}>
                  <Field
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

        {/* Kaydet + Stok Girişi */}
        <div className="mt-6 flex gap-3">
          <Button
            variant="primary"
            disabled={saving || !categoryName || !isDirty}
            onClick={handleSave}
          >
            {saving ? "Kaydediliyor..." : "Kaydet"}
          </Button>

          {lastSaved && (
            <Button
              variant="outline"
              onClick={() =>
                navigate("/stock-entry", {
                  state: {
                    categoryName,
                    typeId: lastSaved.typeId,
                    masterId: String(lastSaved.id),
                  },
                })
              }
            >
              Stok Girişi
            </Button>
          )}
        </div>
      </ComponentCard>
    </div>
  );
}
  