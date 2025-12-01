// src/pages/Stock/StockListPage.tsx
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

type Row = {
  id: number;
  barcode: string;
  status?: string | null;
  warehouse?: { id: number; name: string };
  location?: { id: number; name: string };
  master?: {
    id: number;
    bimeks_product_name?: string | null;
    bimeks_code?: string | null;
  };
  width?: number | null;
  height?: number | null;
  area?: number | null;
  created_by?: number | null;
  approved_by?: number | null;
  created_by_user?: { id: number; username?: string; full_name?: string } | null;
  approved_by_user?: {
    id: number;
    username?: string;
    full_name?: string;
  } | null;
  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;
  notes?: string | null;
  invoice_no?: string | null;
};

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => ({
    Tip: "Komponent", // bu sayfada hep komponent
    Barkod: r.barcode,
    Tanım: r.master?.bimeks_product_name ?? "",
    En: r.width ?? "",
    Boy: r.height ?? "",
    Alan: r.area ?? "",
    Depo: r.warehouse?.name ?? "",
    Lokasyon: r.location?.name ?? "",
    "Fatura No": r.invoice_no ?? "",
    Durum: r.status ?? "",
    Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, "depo-stok.xlsx");
}

export default function ComponentListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [master, setMaster] = useState("");
  const [statusId, setStatusId] = useState("");
  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>(
    []
  );
  const [masters, setMasters] = useState<{ id: number; bimeks_product_name?: string }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/lookups/warehouses").then((r) => setWarehouses(r.data || []));
  }, []);
  useEffect(() => {
    api.get("/masters").then((r) => setMasters(r.data || []));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/components", {
        params: {
          search: q || undefined,
          warehouseId: warehouse || undefined,
          masterId: master || undefined,
          statusId: statusId || undefined, // 👈 EKLE
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

  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "Depo (tümü)" },
      ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [warehouses]
  );

  const masterOptions = useMemo(
    () => [
      { value: "", label: "Tanım (tümü)" },
      ...masters.map((m) => ({
        value: String(m.id),
        label: m.bimeks_product_name || `#${m.id}`,
      })),
    ],
    [masters]
  );

  const statusOptions = useMemo(
  () => [
    { value: "", label: "Durum (tümü)" },
    { value: "1", label: "Stokta" },        // STATUS.in_stock
    { value: "4", label: "Beklemede" },     // STATUS.pending
    { value: "2", label: "Kullanıldı" },    // STATUS.used
    { value: "3", label: "Satıldı" },       // STATUS.sold
    { value: "5", label: "Hasarlı/Kayıp" }, // STATUS.damaged_lost
    { value: "6", label: "Üretimde" },      // STATUS.production
    { value: "7", label: "Baskıda" },       // STATUS.screenprint
  ],
  []
);

  return (
    <div className="space-y-6">
      <PageMeta title="Stok Listesi" description="Stok hareket ve mevcutlar" />
      <PageBreadcrumb pageTitle="Stok Listesi" />

      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
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
          <Select
            options={masterOptions}
            value={master}
            onChange={setMaster}
            placeholder="Tanım"
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
                  "En",
                  "Boy",
                  "Alan",
                  "Durum",
                  "Depo",
                  "Lokasyon",
                  "Fatura No",
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
                    colSpan={15}
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
                    <td className="px-4 py-3">
                      <Link
                        to={`/details/component/${r.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.barcode}
                      </Link>
                    </td>

                    <td className="px-4 py-3 min-w-[240px]">
                      {r.master?.bimeks_product_name ? (
                        <Link
                          to={`/details/component/${r.id}`}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {r.master.bimeks_product_name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.width ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.height ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.area ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.status ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.warehouse?.name ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.location?.name ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.invoice_no ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.created_by_user?.full_name ??
                        r.created_by_user?.username ??
                        r.created_by ??
                        (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                    </td>

                    <td className="px-4 py-3">
                      {r.approved_by_user?.full_name ??
                        r.approved_by_user?.username ??
                        r.approved_by ??
                        (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                    </td>
                    <td className="px-4 py-3">
                      {r.created_at ? (
                        new Date(r.created_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.updated_at ? (
                        new Date(r.updated_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.approved_at ? (
                        new Date(r.approved_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.notes ?? (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={15}
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
