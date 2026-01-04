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

type StockUnit = "area" | "weight" | "length" | "unit" | string;

type Row = {
  id: number;
  barcode: string;
  entry_type?: "Count" | "Purchase" | string | null;
  status?: string | null;

  warehouse?: { id: number; name: string };
  location?: { id: number; name: string };

  master?: {
    id: number;
    bimeks_product_name?: string | null;
    bimeks_code?: string | null;
    stock_unit?: StockUnit | null; // area / weight / length / unit
  };

  width?: number | null;
  height?: number | null;
  area?: number | null;

  weight?: number | null;
  length?: number | null;
  box_unit?: number | null; // ✅ components.box_unit

  created_by?: number | null;
  approved_by?: number | null;

  created_by_user?: { id: number; username?: string; full_name?: string } | null;
  approved_by_user?: { id: number; username?: string; full_name?: string } | null;

  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;

  notes?: string | null;
  invoice_no?: string | null;
};

const dash = <span className="text-gray-400 dark:text-gray-500">—</span>;

const entryTypeLabel = (v?: string | null) => {
  const x = (v || "").toString().trim().toLowerCase();
  if (x === "count") return "Sayım";
  if (x === "purchase") return "Satın Alma";
  return "—";
};


function normalizeUnit(u?: string | null): string {
  return (u || "").toString().trim().toLowerCase();
}

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => {
    const unit = normalizeUnit(r.master?.stock_unit);

    const en = unit === "area" ? r.width ?? "" : "";
    const boy = unit === "area" ? r.height ?? "" : "";
    const alan = unit === "area" ? r.area ?? "" : "";
    const uzunluk = unit === "length" ? r.length ?? "" : "";
    const agirlik = unit === "weight" ? r.weight ?? "" : "";
    const koliIciAdet = unit === "box_unit" ? r.box_unit ?? "" : "";

    return {
      Tip: "Komponent",
      Barkod: r.barcode,
      "Tanım": r.master?.bimeks_product_name ?? "",
      "Bimeks Kodu": r.master?.bimeks_code ?? "",
      "Giriş Tipi": entryTypeLabel(r.entry_type) === "—" ? "" : entryTypeLabel(r.entry_type),
      "Birim": unit || "",
      En: en,
      Boy: boy,
      Alan: alan,
      Uzunluk: uzunluk,
      "Ağırlık": agirlik,
      "Koli İçi Adet": koliIciAdet,
      Depo: r.warehouse?.name ?? "",
      Lokasyon: r.location?.name ?? "",
      "Fatura No": r.invoice_no ?? "",
      Durum: r.status ?? "",
      Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
    };
  });

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
  const unitLabel = (u?: string | null) => {
  switch ((u || "").toLowerCase()) {
    case "unit": return "Adet";
    case "length": return "Uzunluk";
    case "weight": return "Ağırlık";
    case "area": return "Alan";
    case "box_unit": return "Koli İçi Adet"
    default: return "-";
  }
};


  const [warehouses, setWarehouses] = useState<{ id: number; name: string }[]>([]);
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

  const warehouseOptions = useMemo(
    () => [{ value: "", label: "Depo (tümü)" }, ...warehouses.map((w) => ({ value: String(w.id), label: w.name }))],
    [warehouses]
  );

  const masterOptions = useMemo(
    () => [
      { value: "", label: "Tanım (tümü)" },
      ...masters.map((m) => ({ value: String(m.id), label: m.bimeks_product_name || `#${m.id}` })),
    ],
    [masters]
  );

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

  // ✅ stock_unit'e göre alanları göster
  const renderWidth = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "area" ? (r.width ?? dash) : dash);
  const renderHeight = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "area" ? (r.height ?? dash) : dash);
  const renderArea = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "area" ? (r.area ?? dash) : dash);

  const renderWeight = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "weight" ? (r.weight ?? dash) : dash);
  const renderLength = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "length" ? (r.length ?? dash) : dash);
  const renderBoxUnit = (r: Row) => (normalizeUnit(r.master?.stock_unit) === "box_unit" ? (r.box_unit ?? dash) : dash);

  const renderStatus = (r: Row) => r.status ?? dash;

  return (
    <div className="space-y-6">
      <PageMeta title="Stok Listesi" description="Stok hareket ve mevcutlar" />
      <PageBreadcrumb pageTitle="Stok Listesi" />

      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto_auto]">
          <Input
            placeholder="Ara (barkod, tanım, bimeks kodu…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select options={warehouseOptions} value={warehouse} onChange={setWarehouse} placeholder="Depo" />
          <Select options={masterOptions} value={master} onChange={setMaster} placeholder="Tanım" />
          <Select options={statusOptions} value={statusId} onChange={setStatusId} placeholder="Durum" />
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
                  "Bimeks Kodu",
                  "Giriş Tipi",
                  "Ölçü Birimi",
                  "En",
                  "Boy",
                  "Alan",
                  "Ağırlık",
                  "Uzunluk",
                  "Koli İçi Adet",
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
                  <th key={h} className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={20}>
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
                      <Link to={`/details/component/${r.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                        {r.barcode}
                      </Link>
                    </td>

                    <td className="px-4 py-3 min-w-[240px]">
                      {r.master?.bimeks_product_name ? (
                        <Link to={`/details/component/${r.id}`} className="text-brand-600 hover:underline dark:text-brand-400">
                          {r.master.bimeks_product_name}
                        </Link>
                      ) : (
                        dash
                      )}
                    </td>

                    <td className="px-4 py-3 whitespace-nowrap">{r.master?.bimeks_code ? r.master.bimeks_code : dash}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{entryTypeLabel(r.entry_type)}</td>
                    <td className="px-4 py-3 font-medium">{unitLabel(r.master?.stock_unit)}</td>

                    <td className="px-4 py-3">{renderWidth(r)}</td>
                    <td className="px-4 py-3">{renderHeight(r)}</td>
                    <td className="px-4 py-3">{renderArea(r)}</td>
                    <td className="px-4 py-3">{renderWeight(r)}</td>
                    <td className="px-4 py-3">{renderLength(r)}</td>
                    <td className="px-4 py-3">{renderBoxUnit(r)}</td>

                    <td className="px-4 py-3">{renderStatus(r)}</td>
                    <td className="px-4 py-3">{r.warehouse?.name ?? dash}</td>
                    <td className="px-4 py-3">{r.location?.name ?? dash}</td>

                    <td className="px-4 py-3">{r.invoice_no ?? dash}</td>

                    <td className="px-4 py-3">
                      {r.created_by_user?.full_name ?? r.created_by_user?.username ?? r.created_by ?? dash}
                    </td>

                    <td className="px-4 py-3">
                      {r.approved_by_user?.full_name ?? r.approved_by_user?.username ?? r.approved_by ?? dash}
                    </td>

                    <td className="px-4 py-3">{r.created_at ? new Date(r.created_at).toLocaleString() : dash}</td>

                    <td className="px-4 py-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : dash}</td>

                    <td className="px-4 py-3">{r.approved_at ? new Date(r.approved_at).toLocaleString() : dash}</td>

                    <td className="px-4 py-3">{r.notes ?? dash}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={20}>
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
