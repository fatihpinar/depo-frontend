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
import { formatQtyTR } from "../../utils/numberFormat";

/* ================== TYPES ================== */

type StockUnitCode = "area" | "weight" | "length" | "unit";

type Row = {
  id: number;
  barcode: string;

  status?: string | null; // status_label || status_code (BE mapper)

  warehouse?: { id: number; name: string } | undefined;
  location?: { id: number; name: string } | undefined;

  master?: {
    id: number;
    display_label?: string | null;
    stock_unit?: { id: number; code: StockUnitCode | null; label: string | null } | null;
  } | undefined;

  width?: number | null;
  height?: number | null;
  area?: number | null;

  weight?: number | null;
  length?: number | null;

  created_by?: number | null;
  approved_by?: number | null;

  created_by_user?: { id: number; username?: string | null; full_name?: string | null } | null;
  approved_by_user?: { id: number; username?: string | null; full_name?: string | null } | null;

  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;

  notes?: string | null;
  invoice_no?: string | null;
};

type MasterOption = { id: number; display_label?: string | null };
type WarehouseOption = { id: number; name: string };

/* ================== HELPERS ================== */

const dash = <span className="text-gray-400 dark:text-gray-500">—</span>;
const fmt = (v?: number | string | null) => formatQtyTR(v, { empty: "—" });

function normalizeUnit(u?: string | null): string {
  return (u || "").toString().trim().toLowerCase();
}

function unitLabelTR(code?: StockUnitCode | string | null) {
  switch ((code || "").toString().toLowerCase()) {
    case "unit":
      return "Adet";
    case "length":
      return "Uzunluk";
    case "weight":
      return "Ağırlık";
    case "area":
      return "Alan";
    default:
      return "—";
  }
}

function unitSuffix(code?: StockUnitCode | string | null) {
  switch ((code || "").toString().toLowerCase()) {
    case "area":
      return "m²";
    case "weight":
      return "kg";
    case "length":
      return "m";
    case "unit":
      return "EA";
    default:
      return "";
  }
}

/* ================== EXCEL EXPORT ================== */

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => {
    const unit = normalizeUnit(r.master?.stock_unit?.code || "");

    const en = unit === "area" ? r.width ?? "" : "";
    const boy = unit === "area" ? r.height ?? "" : "";
    const alan = unit === "area" ? r.area ?? "" : "";
    const uzunluk = unit === "length" ? r.length ?? "" : "";
    const agirlik = unit === "weight" ? r.weight ?? "" : "";

    return {
      Tip: "Komponent",
      Barkod: r.barcode,
      Tanım: r.master?.display_label ?? "",
      "Ölçü Birimi": unitLabelTR(unit),
      En: en,
      Boy: boy,
      Alan: alan,
      Uzunluk: uzunluk,
      "Ağırlık": agirlik,
      Depo: r.warehouse?.name ?? "",
      Lokasyon: r.location?.name ?? "",
      "Fatura No": r.invoice_no ?? "",
      Durum: r.status ?? "",
      "Oluşturan": r.created_by_user?.full_name ?? r.created_by_user?.username ?? (r.created_by ?? ""),
      "Onaylayan": r.approved_by_user?.full_name ?? r.approved_by_user?.username ?? (r.approved_by ?? ""),
      "Oluşturma": r.created_at ? new Date(r.created_at).toLocaleString() : "",
      "Güncelleme": r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
      "Onay Tarihi": r.approved_at ? new Date(r.approved_at).toLocaleString() : "",
      Notlar: r.notes ?? "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, "depo-stok.xlsx");
}

/* ================== PAGE ================== */

export default function StockListPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const [q, setQ] = useState("");
  const [warehouseId, setWarehouseId] = useState("");
  const [masterId, setMasterId] = useState("");
  const [statusId, setStatusId] = useState("");

  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const [masters, setMasters] = useState<MasterOption[]>([]);

  const [loading, setLoading] = useState(false);

  // lookups
  useEffect(() => {
    api.get("/lookups/warehouses").then((r) => setWarehouses(r.data || []));
  }, []);

  useEffect(() => {
    // masters list endpoint: display_label var
    api.get("/masters").then((r) => setMasters(r.data || []));
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/components", {
        params: {
          search: q || undefined,
          warehouseId: warehouseId || undefined,
          masterId: masterId || undefined,
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
      ...masters.map((m) => ({ value: String(m.id), label: m.display_label || `#${m.id}` })),
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
  const unitCodeOf = (r: Row) => normalizeUnit(r.master?.stock_unit?.code || "");

  const renderWidth  = (r: Row) => (unitCodeOf(r) === "area"   ? fmt(r.width)  : dash);
  const renderHeight = (r: Row) => (unitCodeOf(r) === "area"   ? fmt(r.height) : dash);
  const renderArea   = (r: Row) => (unitCodeOf(r) === "area"   ? fmt(r.area)   : dash);

  const renderWeight = (r: Row) => (unitCodeOf(r) === "weight" ? fmt(r.weight) : dash);
  const renderLength = (r: Row) => (unitCodeOf(r) === "length" ? fmt(r.length) : dash);

  const renderStatus = (r: Row) => r.status ?? dash;

  return (
    <div className="space-y-6">
      <PageMeta title="Stok Listesi" description="Komponent stok listesi" />
      <PageBreadcrumb pageTitle="Stok Listesi" />

      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_1fr_auto_auto]">
          <Input
            placeholder="Ara (barkod, tanım, fatura no…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          <Select options={warehouseOptions} value={warehouseId} onChange={setWarehouseId} placeholder="Depo" />
          <Select options={masterOptions} value={masterId} onChange={setMasterId} placeholder="Tanım" />
          <Select options={statusOptions} value={statusId} onChange={setStatusId} placeholder="Durum" />

          <Button variant="primary" onClick={fetchData}>
            Uygula
          </Button>

          <Button variant="outline" onClick={() => exportToExcel(rows)} disabled={!rows.length}>
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
                  "Ölçü Birimi",
                  "En",
                  "Boy",
                  "Alan",
                  "Ağırlık",
                  "Uzunluk",
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
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={18}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => {
                  const unitCode = (r.master?.stock_unit?.code || null) as StockUnitCode | null;
                  const unitText = unitLabelTR(unitCode);
                  const suffix = unitSuffix(unitCode);

                  return (
                    <tr
                      key={r.id}
                      className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5"
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={`/details/component/${r.id}`}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {r.barcode}
                        </Link>
                      </td>

                      <td className="px-4 py-3 min-w-[260px]">
                        {r.master?.display_label ? (
                          <Link
                            to={`/details/component/${r.id}`}
                            className="text-brand-600 hover:underline dark:text-brand-400"
                            title={r.master.display_label}
                          >
                            {r.master.display_label}
                          </Link>
                        ) : (
                          dash
                        )}
                      </td>

                      <td className="px-4 py-3 font-medium whitespace-nowrap">
                        {unitText}
                        {suffix ? <span className="text-gray-500 dark:text-gray-400"> ({suffix})</span> : null}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">{renderWidth(r)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderHeight(r)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderArea(r)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderWeight(r)}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{renderLength(r)}</td>

                      <td className="px-4 py-3 whitespace-nowrap">{renderStatus(r)}</td>

                      <td className="px-4 py-3 whitespace-nowrap">{r.warehouse?.name ?? dash}</td>
                      <td className="px-4 py-3 whitespace-nowrap">{r.location?.name ?? dash}</td>

                      <td className="px-4 py-3 whitespace-nowrap">{r.invoice_no ?? dash}</td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.created_by_user?.full_name ?? r.created_by_user?.username ?? r.created_by ?? dash}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.approved_by_user?.full_name ?? r.approved_by_user?.username ?? r.approved_by ?? dash}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.created_at ? new Date(r.created_at).toLocaleString() : dash}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.updated_at ? new Date(r.updated_at).toLocaleString() : dash}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {r.approved_at ? new Date(r.approved_at).toLocaleString() : dash}
                      </td>

                      <td className="px-4 py-3 min-w-[240px]">{r.notes ?? dash}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={18}>
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* küçük dipnot */}
      <div className="text-xs text-gray-500 dark:text-gray-400">
        Not: En/Boy/Alan yalnızca “Alan” biriminde; Ağırlık yalnızca “Ağırlık” biriminde; Uzunluk yalnızca “Uzunluk”
        biriminde görüntülenir.
      </div>
    </div>
  );
}
