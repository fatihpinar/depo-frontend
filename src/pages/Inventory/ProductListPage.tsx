// src/pages/Product/ProductsListPage.tsx
import { useEffect, useMemo, useState } from "react";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import api from "../../services/api";
import { Link } from "react-router-dom";
import * as XLSX from "xlsx";

/* ---------- Types ---------- */
type Row = {
  id: number;
  barcode: string;
  product_name?: string | null;
  recipe_id?: string | null;
  bimeks_code?: string | null;

  status?: string | null;
  warehouse?: { id: number; name: string };
  location?: { id: number; name: string };

  created_by?: number | null;
  approved_by?: number | null;
  created_by_user?: { id: number; username?: string; full_name?: string } | null;
  approved_by_user?: { id: number; username?: string; full_name?: string } | null;

  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;
  notes?: string | null;
};

type WarehouseOpt = { id: number; name: string };

/* ---------- Excel ---------- */
function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => ({
    Barkod: r.barcode,
    Tanım: r.product_name ?? "",
    Durum: r.status ?? "",
    Depo: r.warehouse?.name ?? "",
    Lokasyon: r.location?.name ?? "",
    Oluşturma: r.created_at ? new Date(r.created_at).toLocaleString() : "",
    Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
    "Onay Tarihi": r.approved_at ? new Date(r.approved_at).toLocaleString() : "",
    Notlar: r.notes ?? "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Ürünler");
  XLSX.writeFile(wb, "urun-listesi.xlsx");
}

export default function ProductsListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [warehouses, setWarehouses] = useState<WarehouseOpt[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusId, setStatusId] = useState("");
  const statusOptions = useMemo(
  () => [
    { value: "", label: "Durum (tümü)" },
    { value: "1", label: "Stokta" },
    { value: "4", label: "Beklemede" },
    { value: "2", label: "Kullanıldı" },
    { value: "3", label: "Satıldı" },
    { value: "5", label: "Hasarlı/Kayıp" },
    { value: "6", label: "Üretimde" },
    { value: "7", label: "Baskıda" },
  ],
  []
);


  /* lookups */
  useEffect(() => {
    api.get("lookups/warehouses").then((r) => setWarehouses(r.data || []));
  }, []);

  /* data */
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/products", {
        params: {
          search: q || undefined,
          warehouseId: warehouse || undefined,
          statusId: statusId || undefined,
        },
      });
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* options */
  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "Depo (tümü)" },
      ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [warehouses]
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title="Ürün Listesi | TailAdmin"
        description="Oluşturulan ürünler"
      />
      <PageBreadcrumb pageTitle="Ürün Listesi" />

      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto_auto]">
          <Input
            placeholder="Ara (barkod, tanım…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            options={warehouseOptions}
            value={warehouse}
            onChange={setWarehouse}
            placeholder="Depo"
          />
          {/* YENİ: Durum filtresi */}
          <Select
            options={statusOptions}
            value={statusId}
            onChange={setStatusId}
            placeholder="Durum"
          />
          <Button variant="primary" onClick={fetchData}>
            Uygula
          </Button>
          <Button variant="primary" onClick={() => exportToExcel(rows)}>
            Excel’e Aktar
          </Button>
        </div>
      </ComponentCard>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto scroll-area">
          <table className="w-full text-sm text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="text-left">
                {[
                  "Barkod",
                  "Tanım",
                  "Durum",
                  "Depo",
                  "Lokasyon",
                  "Oluşturan",
                  "Onaylayan",
                  "Oluşturma",
                  "Güncelleme",
                  "Onay Tarihi",
                  "Notlar",
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={11}
                  >
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    {/* Barkod */}
                    <td className="px-4 py-3">
                      <Link
                        to={`/details/product/${r.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.barcode || "—"}
                      </Link>
                    </td>

                    {/* Tanım -> ürün adı */}
                    <td className="px-4 py-3 min-w-[240px]">
                      {r.product_name ? (
                        <Link
                          to={`/details/product/${r.id}`}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {r.product_name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3">
                      {r.status ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Depo */}
                    <td className="px-4 py-3">
                      {r.warehouse?.name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Lokasyon */}
                    <td className="px-4 py-3">
                      {r.location?.name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Oluşturan */}
                    <td className="px-4 py-3">
                      {r.created_by_user?.full_name ??
                        r.created_by_user?.username ??
                        r.created_by ?? (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                    </td>

                    {/* Onaylayan */}
                    <td className="px-4 py-3">
                      {r.approved_by_user?.full_name ??
                        r.approved_by_user?.username ??
                        r.approved_by ?? (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                    </td>

                    {/* Oluşturma */}
                    <td className="px-4 py-3">
                      {r.created_at ? (
                        new Date(r.created_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Güncelleme */}
                    <td className="px-4 py-3">
                      {r.updated_at ? (
                        new Date(r.updated_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Onay Tarihi */}
                    <td className="px-4 py-3">
                      {r.approved_at ? (
                        new Date(r.approved_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    {/* Notlar */}
                    <td className="px-4 py-3">
                      {r.notes ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={11}
                  >
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
