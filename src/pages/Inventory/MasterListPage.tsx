import { useEffect, useMemo, useState, useCallback } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import api from "../../services/api";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

/* ================== EXCEL EXPORT (YALIN) ================== */

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => ({
    "Ürün Tanımı": r.display_label ?? "",
    "Kategori": r.category_name ?? "",
    "Tür": r.type_name ?? "",
    "Tedarikçi": r.supplier_name ?? "",
    "Ölçü Birimi": r.stock_unit_label ?? r.stock_unit_code ?? "",
    "Oluşturma": r.created_at ? new Date(r.created_at).toLocaleString() : "",
    "Güncelleme": r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Tanımlar");
  XLSX.writeFile(wb, "master-tanimlar.xlsx");
}

/* ================== TYPES ================== */

type StockUnitCode = "area" | "weight" | "length" | "unit";

type Lookup = {
  id: number;
  name: string;
};

type StockUnit = {
  id: number;
  code: StockUnitCode;
  label: string;
  is_active?: boolean;
  sort_order?: number;
};

type Row = {
  id: number;
  display_label: string;

  category_id: number;
  type_id: number;
  supplier_id?: number | null;
  stock_unit_id: number;

  // join fields (backend döndürebilir; dönmezse FE map’ler)
  category_name?: string | null;
  type_name?: string | null;
  supplier_name?: string | null;
  stock_unit_code?: StockUnitCode | null;
  stock_unit_label?: string | null;

  created_at?: string;
  updated_at?: string;
};

export default function MasterListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // filters
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");

  // lookups
  const [categories, setCategories] = useState<Lookup[]>([]);
  const [types, setTypes] = useState<{ id: number; name: string; category_id: number }[]>([]);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const [stockUnits, setStockUnits] = useState<StockUnit[]>([]);

  /* ================== HELPERS ================== */

  const hydrateRow = useCallback(
    (r: Row): Row => {
      const catName =
        r.category_name ??
        categories.find((c) => c.id === r.category_id)?.name ??
        null;

      const typeName =
        r.type_name ??
        types.find((t) => t.id === r.type_id)?.name ??
        null;

      const supplierName =
        r.supplier_name ??
        suppliers.find((s) => s.id === r.supplier_id)?.name ??
        null;

      const su = stockUnits.find((x) => x.id === r.stock_unit_id);
      const stockUnitLabel = r.stock_unit_label ?? su?.label ?? null;
      const stockUnitCode = (r.stock_unit_code ?? su?.code ?? null) as any;

      return {
        ...r,
        category_name: catName,
        type_name: typeName,
        supplier_name: supplierName,
        stock_unit_label: stockUnitLabel,
        stock_unit_code: stockUnitCode,
      };
    },
    [categories, types, suppliers, stockUnits]
  );

  /* ================== FETCH ================== */

  const fetchMasters = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/masters", {
        params: {
          search: q.trim() || undefined,
          categoryId: categoryId || undefined,
          typeId: typeId || undefined,
          supplierId: supplierId || undefined,
        },
      });

      const list: Row[] = res.data || [];
      setRows(list.map(hydrateRow));
    } finally {
      setLoading(false);
    }
  }, [q, categoryId, typeId, supplierId, hydrateRow]);

  // initial load
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [catRes, supRes, suRes, mastersRes] = await Promise.all([
          api.get("/lookups/categories"),
          api.get("/lookups/suppliers"),
          api.get("/lookups/stock-units"),
          api.get("/masters"),
        ]);

        setCategories(catRes.data || []);
        setSuppliers(supRes.data || []);
        setStockUnits(suRes.data || []);

        const list: Row[] = mastersRes.data || [];
        setRows(list.map((r) => r)); // hydrate aşağıdaki effect’te
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // category change -> types load + type reset
  useEffect(() => {
    setTypeId("");
    setTypes([]);

    const id = Number(categoryId);
    if (!id) return;

    api
      .get(`/lookups/types/${id}`)
      .then((r) => setTypes(r.data || []))
      .catch(() => setTypes([]));
  }, [categoryId]);

  // lookups değişince mevcut rows’u hydrate et (join alanları backend’den gelmiyorsa)
  useEffect(() => {
    setRows((prev) => prev.map(hydrateRow));
  }, [hydrateRow]);

  /* ================== OPTIONS ================== */

  const categoryOptions = useMemo(
    () => [
      { value: "", label: "Kategori (tümü)" },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories]
  );

  const typeOptions = useMemo(
    () => [
      { value: "", label: "Tür (tümü)" },
      ...types.map((t) => ({ value: String(t.id), label: t.name })),
    ],
    [types]
  );

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Tedarikçi (tümü)" },
      ...suppliers.map((s) => ({ value: String(s.id), label: s.name })),
    ],
    [suppliers]
  );

  /* ================== UI ================== */

  return (
    <div className="space-y-6">
      <PageMeta title="Tanım Listesi | TailAdmin" description="Master tanımları" />
      <PageBreadcrumb pageTitle="Tanım Listesi" />

      {/* Filtreler */}
      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr_1fr_1fr_1fr_auto]">
          <Input
            placeholder="Ara (tanım / kategori / tür / tedarikçi)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select
            options={categoryOptions}
            value={categoryId}
            onChange={setCategoryId}
            placeholder="Kategori"
          />

          <Select
            options={typeOptions}
            value={typeId}
            onChange={setTypeId}
            placeholder={categoryId ? "Tür" : "Önce kategori"}
          />

          <Select
            options={supplierOptions}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Tedarikçi"
          />

          <div className="flex gap-2">
            <Button variant="primary" onClick={fetchMasters}>
              Uygula
            </Button>

            <Button
              variant="outline"
              onClick={async () => {
                setQ("");
                setCategoryId("");
                setTypeId("");
                setSupplierId("");
                // state reset async; yine de net olsun diye küçük gecikme:
                setTimeout(() => fetchMasters().catch(() => {}), 0);
              }}
            >
              Sıfırla
            </Button>
          </div>
        </div>

        <div className="mt-4">
          <Button
            variant="primary"
            onClick={() => exportToExcel(rows)}
            disabled={!rows.length}
          >
            Excel’e Aktar
          </Button>
        </div>
      </ComponentCard>

      {/* Liste */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Ürün Tanımı
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Kategori
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Tür
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Tedarikçi
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Ölçü Birimi
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Oluşturma
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Güncelleme
                </th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/details/master/${r.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.display_label || `#${r.id}`}
                      </Link>
                    </td>

                    <td className="px-4 py-3">
                      {r.category_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      {r.type_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      {r.supplier_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </td>

                    <td className="px-4 py-3">
                      {r.stock_unit_label ?? r.stock_unit_code ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.created_at ? new Date(r.created_at).toLocaleString() : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={7}>
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
