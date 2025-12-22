// src/pages/Details/MasterDetailPage.tsx
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";

/* ================== TYPES ================== */

type StockUnitCode = "area" | "weight" | "length" | "unit";

type Category = { id: number; name: string };
type TypeRow = { id: number; name: string; category_id: number };
type Supplier = { id: number; name: string };
type StockUnit = { id: number; code: StockUnitCode; label: string; is_active?: boolean; sort_order?: number };

type MasterDetail = {
  id: number;
  display_label: string;
  category_id: number;
  type_id: number;
  supplier_id?: number | null;
  stock_unit_id: number;

  // join (opsiyonel)
  category_name?: string | null;
  type_name?: string | null;
  supplier_name?: string | null;
  stock_unit_code?: StockUnitCode | null;
  stock_unit_label?: string | null;

  created_at?: string;
  updated_at?: string;
};

type StockSummary = {
  master_id: number;
  stock_unit_code: StockUnitCode;

  // status bazlı (in_stock / pending / used / sold vs)
  by_status: Array<{
    status_id: number;
    status_code?: string | null;
    status_label?: string | null;

    count: number;       // adet (satır sayısı)
    qty_sum: number;     // unit’e göre alan/ağırlık/uzunluk toplamı (unit ise 0 kalabilir)
  }>;

  // depo bazlı (opsiyonel)
  by_warehouse: Array<{
    warehouse_id: number | null;
    warehouse_name: string | null;

    count: number;
    qty_sum: number;
  }>;
};

/* ================== HELPERS ================== */

const createSelectOption = (value: string | number, label: string, disabled = false) => ({
  value: String(value),
  label,
  disabled,
});

const unitSuffix = (u?: StockUnitCode | string | null) => {
  if (u === "area") return "m²";
  if (u === "weight") return "kg";
  if (u === "length") return "m";
  if (u === "unit") return "EA";
  return "";
};

const fmtQty = (n: any) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
};

const fmtInt = (n: any) => {
  const v = Number(n);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("tr-TR", { maximumFractionDigits: 0 });
};

function statusLabelFallback(s: { status_label?: any; status_code?: any; status_id: number }) {
  return s.status_label || s.status_code || `#${s.status_id}`;
}

/* ================== PAGE ================== */

export default function MasterDetailPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const id = Number(rawId || 0);

  const [loading, setLoading] = useState(true);

  // lookups
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([]);
  const [types, setTypes] = useState<TypeRow[]>([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // master
  const [master, setMaster] = useState<MasterDetail | null>(null);

  // editable form state
  const [displayLabel, setDisplayLabel] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [typeId, setTypeId] = useState("");
  const [supplierId, setSupplierId] = useState(""); // nullable
  const [stockUnitId, setStockUnitId] = useState("");

  const [saving, setSaving] = useState(false);

  // stock summary
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [stockSummary, setStockSummary] = useState<StockSummary | null>(null);

  const loadTypes = useCallback(async (catId: number) => {
    setTypesLoading(true);
    try {
      const res = await api.get(`/lookups/types/${catId}`);
      setTypes(res.data || []);
    } catch (e) {
      console.error("types load error:", e);
      setTypes([]);
    } finally {
      setTypesLoading(false);
    }
  }, []);

  const refreshSummary = useCallback(async () => {
    if (!id) return;
    setSummaryLoading(true);
    try {
      const res = await api.get(`/masters/${id}/stock-summary`);
      setStockSummary(res.data || null);
    } catch (e) {
      console.error("stock summary load error:", e);
      setStockSummary(null);
    } finally {
      setSummaryLoading(false);
    }
  }, [id]);

  // initial load
  useEffect(() => {
    if (!id) {
      navigate("/404");
      return;
    }

    (async () => {
      setLoading(true);
      try {
        const [catRes, supRes, suRes, masterRes] = await Promise.all([
          api.get("/lookups/categories"),
          api.get("/lookups/suppliers"),
          api.get("/lookups/stock-units"),
          api.get(`/masters/${id}`),
        ]);

        setCategories(catRes.data || []);
        setSuppliers(supRes.data || []);
        setStockUnits(suRes.data || []);

        const m: MasterDetail = masterRes.data || null;
        setMaster(m);

        // form init
        setDisplayLabel(m?.display_label || "");
        setCategoryId(m?.category_id ? String(m.category_id) : "");
        setTypeId(m?.type_id ? String(m.type_id) : "");
        setSupplierId(m?.supplier_id ? String(m.supplier_id) : "");
        setStockUnitId(m?.stock_unit_id ? String(m.stock_unit_id) : "");

        // types for category
        if (m?.category_id) {
          await loadTypes(Number(m.category_id));
        }

        // stock summary
        await refreshSummary();
      } catch (e) {
        console.error("master detail load error:", e);
        alert("Detay yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate, loadTypes, refreshSummary]);

  // category change -> load types + reset type
  useEffect(() => {
    setTypeId("");
    setTypes([]);
    const cat = Number(categoryId);
    if (!cat) return;
    loadTypes(cat);
  }, [categoryId, loadTypes]);

  const categoryOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...categories.map((c) => createSelectOption(c.id, c.name)),
    ],
    [categories]
  );

  const typeOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz", true),
      ...types.map((t) => createSelectOption(t.id, t.name)),
    ],
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      createSelectOption("", "Seçiniz"),
      ...suppliers.map((s) => createSelectOption(s.id, s.name)),
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

  const isDirty = useMemo(() => {
    if (!master) return false;
    return (
      displayLabel !== (master.display_label || "") ||
      categoryId !== String(master.category_id || "") ||
      typeId !== String(master.type_id || "") ||
      supplierId !== String(master.supplier_id || "") ||
      stockUnitId !== String(master.stock_unit_id || "")
    );
  }, [master, displayLabel, categoryId, typeId, supplierId, stockUnitId]);

  const validate = (): string[] => {
    const missing: string[] = [];
    if (!displayLabel.trim()) missing.push("Tanım");
    if (!categoryId) missing.push("Kategori");
    if (!typeId) missing.push("Tür");
    if (!stockUnitId) missing.push("Ölçü Birimi");
    return missing;
  };

  const handleSave = async () => {
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

      // ✅ NOT: sende endpoint farklıysa burada değiştir.
      const res = await api.put(`/masters/${id}/full`, payload);
      const updated: MasterDetail = res.data;

      setMaster(updated);

      // form sync
      setDisplayLabel(updated.display_label || "");
      setCategoryId(updated.category_id ? String(updated.category_id) : "");
      setTypeId(updated.type_id ? String(updated.type_id) : "");
      setSupplierId(updated.supplier_id ? String(updated.supplier_id) : "");
      setStockUnitId(updated.stock_unit_id ? String(updated.stock_unit_id) : "");

      alert("Tanım güncellendi.");

      // stok birimi değiştiyse summary label/suffix farklı görünebilir → yenile
      await refreshSummary();
    } catch (err: any) {
      console.error("master save error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "Kaydetme hatası.");
    } finally {
      setSaving(false);
    }
  };

  const m = master;

  const summaryUnitCode: StockUnitCode =
    (stockSummary?.stock_unit_code as StockUnitCode) ||
    (m?.stock_unit_code as StockUnitCode) ||
    (stockUnits.find((su) => String(su.id) === String(m?.stock_unit_id))?.code as StockUnitCode) ||
    "area";

  return (
    <div className="space-y-6">
      <PageMeta title="Tanım Detay" description="Tanım (master) ve stok özeti" />
      <PageBreadcrumb pageTitle="Tanım Detay" />

      {loading ? (
        <ComponentCard title="Yükleniyor…">
          <div className="py-6 text-sm text-gray-500">Lütfen bekleyin…</div>
        </ComponentCard>
      ) : !m ? (
        <ComponentCard title="Bulunamadı">
          <div className="py-6 text-sm text-gray-500">Kayıt bulunamadı.</div>
        </ComponentCard>
      ) : (
        <>
          {/* ========== Master ========== */}
          <ComponentCard title="Tanım (Master)">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="md:col-span-2">
                <Label>Tanım</Label>
                <Input
                  value={displayLabel}
                  onChange={(e) => setDisplayLabel(e.target.value)}
                  placeholder="Örn: Çift taraflı bant 1mm"
                />
              </div>

              <div>
                <Label>Kategori</Label>
                <Select options={categoryOptions} value={categoryId} onChange={setCategoryId} />
              </div>

              <div>
                <Label>Tür</Label>
                <Select
                  options={typeOptions}
                  value={typeId}
                  onChange={setTypeId}
                  placeholder={!categoryId ? "Önce kategori seçiniz" : typesLoading ? "Yükleniyor..." : "Seçiniz"}
                />
              </div>

              <div>
                <Label>Tedarikçi</Label>
                <Select options={supplierOptions} value={supplierId} onChange={setSupplierId} />
              </div>

              <div>
                <Label>Ölçü Birimi</Label>
                <Select options={stockUnitOptions} value={stockUnitId} onChange={setStockUnitId} />
              </div>

              <div>
                <Label>Oluşturma</Label>
                <Input value={m.created_at ? new Date(m.created_at).toLocaleString() : ""} disabled />
              </div>

              <div>
                <Label>Güncelleme</Label>
                <Input value={m.updated_at ? new Date(m.updated_at).toLocaleString() : ""} disabled />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(-1)}>
                Geri
              </Button>
              <Button variant="primary" onClick={handleSave} disabled={!isDirty || saving}>
                {saving ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </div>
          </ComponentCard>

          {/* ========== Stock Summary ========== */}
          <ComponentCard title="Stok Özeti">
            {summaryLoading ? (
              <div className="py-6 text-sm text-gray-500">Yükleniyor…</div>
            ) : !stockSummary ? (
              <div className="py-6 text-sm text-gray-500">
                Stok özeti alınamadı (endpoint yoksa BE ekleyeceğiz).
              </div>
            ) : (
              <div className="space-y-6">
                {/* Status Summary */}
                <div>
                  <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Duruma Göre
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-sm text-gray-700 dark:text-gray-200">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Statü</th>
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Adet</th>
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                            Toplam {unitSuffix(summaryUnitCode)}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockSummary.by_status.length ? (
                          stockSummary.by_status.map((s) => (
                            <tr key={s.status_id} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="px-4 py-3">{statusLabelFallback(s)}</td>
                              <td className="px-4 py-3 text-right">{fmtInt(s.count)}</td>
                              <td className="px-4 py-3 text-right">
                                {summaryUnitCode === "unit" ? "—" : fmtQty(s.qty_sum)}{" "}
                                {summaryUnitCode === "unit" ? "" : unitSuffix(summaryUnitCode)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-4 py-4 text-gray-500 dark:text-gray-400" colSpan={3}>
                              Kayıt yok.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                    Not: “Adet” her zaman komponent satır sayısıdır. “Toplam” ise tanımın ölçü birimine göre (alan/ağırlık/uzunluk) toplanır.
                  </div>
                </div>

                {/* Warehouse Summary */}
                <div>
                  <div className="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-200">
                    Depoya Göre
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-800">
                    <table className="w-full text-sm text-gray-700 dark:text-gray-200">
                      <thead className="bg-gray-50 dark:bg-gray-900/40">
                        <tr className="text-left">
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Depo</th>
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">Adet</th>
                          <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-right">
                            Toplam {unitSuffix(summaryUnitCode)}
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {stockSummary.by_warehouse.length ? (
                          stockSummary.by_warehouse.map((w, idx) => (
                            <tr key={`${w.warehouse_id ?? "null"}-${idx}`} className="border-t border-gray-100 dark:border-gray-800">
                              <td className="px-4 py-3">{w.warehouse_name || "—"}</td>
                              <td className="px-4 py-3 text-right">{fmtInt(w.count)}</td>
                              <td className="px-4 py-3 text-right">
                                {summaryUnitCode === "unit" ? "—" : fmtQty(w.qty_sum)}{" "}
                                {summaryUnitCode === "unit" ? "" : unitSuffix(summaryUnitCode)}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="px-4 py-4 text-gray-500" colSpan={3}>
                              Kayıt yok.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button variant="outline" onClick={refreshSummary}>
                    Yenile
                  </Button>
                </div>
              </div>
            )}
          </ComponentCard>
        </>
      )}
    </div>
  );
}
