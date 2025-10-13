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

function exportToExcel(rows: any[]) {
  const data = rows.map(r => ({
    Tip: r.item_type === "product" ? "Ürün" : "Komponent",
    Barkod: r.barcode,
    Tanım: r.master?.display_label ?? "",
    Birim: r.unit ?? "",
    Miktar: r.quantity ?? "",
    Depo: r.warehouse?.name ?? "",
    Lokasyon: r.location?.name ?? "",
    Durum: r.status ?? "",
    Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, "depo-stok.xlsx");
}


type Row = {
  id: number;
  barcode: string;
  unit: "EA" | "M" | "KG" | string;
  quantity: number;
  status?: string | null;
  warehouse?: { id:number; name:string };
  location?: { id:number; name:string };
  master?: { id:number; display_label?: string|null };
  created_by?: number | null;
  approved_by?: number | null;
  created_at?: string;
  updated_at?: string;
  approved_at?: string | null;
  notes?: string | null;
};

export default function StockListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [master, setMaster] = useState("");
  const [warehouses, setWarehouses] = useState<{id:number;name:string}[]>([]);
  const [masters, setMasters] = useState<{id:number;display_label?:string}[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(()=>{ api.get("/lookups/warehouses").then(r=>setWarehouses(r.data||[])); },[]);
  useEffect(()=>{ api.get("/masters").then(r=>setMasters(r.data||[])); },[]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/components", {
        params: { search: q || undefined, warehouseId: warehouse || undefined, masterId: master || undefined }
      });
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ fetchData(); },[]);

  const warehouseOptions = useMemo(()=>[
    { value:"", label:"Depo (tümü)" },
    ...warehouses.map(w=>({ value:String(w.id), label:w.name })),
  ],[warehouses]);

   const masterOptions = useMemo(()=>[
    { value:"", label:"Tanım (tümü)" },
    ...masters.map(m=>({
      value:String(m.id),
      label: m.display_label || `#${m.id}`
    })),
  ],[masters]);

  return (
    <div className="space-y-6">
      <PageMeta title="Stok Listesi | TailAdmin" description="Stok hareket ve mevcutlar" />
      <PageBreadcrumb pageTitle="Stok Listesi" />

      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input placeholder="Ara (barkod, tanım…)" value={q} onChange={e=>setQ(e.target.value)} />
          <Select options={warehouseOptions} value={warehouse} onChange={setWarehouse} placeholder="Depo" />
          <Select options={masterOptions} value={master} onChange={setMaster} placeholder="Tanım" />
          <Button variant="primary" onClick={fetchData}>Uygula</Button>
          <Button variant="primary" onClick={() => exportToExcel(rows)}>
            Excel’e Aktar
          </Button>
        </div>
      </ComponentCard>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          {/* temel metin rengi (light/dark) */}
          <table className="w-full text-sm text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="text-left">
                {[
                  "Barkod","Tanım","Birim","Miktar","Durum",
                  "Depo","Lokasyon","Oluşturan","Onaylayan",
                  "Oluşturma","Güncelleme","Onay Tarihi","Notlar",
                ].map((h)=>(
                  <th key={h} className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={13}>Yükleniyor…</td>
                </tr>
              ) : rows.length ? (
                rows.map(r=>(
                  <tr key={r.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5">
                    <td className="px-4 py-3">
                    <Link
                      to={`/details/component/${r.id}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {r.barcode}
                    </Link>
                  </td>
                  <td className="px-4 py-3 min-w-[240px]">
                    {r.master?.display_label ? (
                      <Link
                        to={`/details/component/${r.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.master.display_label}
                      </Link>
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">—</span>
                    )}
                  </td>
                    <td className="px-4 py-3">{r.unit}</td>
                    <td className="px-4 py-3">{r.quantity}</td>
                    <td className="px-4 py-3">{r.status ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.warehouse?.name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.location?.name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.created_by ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.approved_by ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.created_at ? new Date(r.created_at).toLocaleString() : <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.approved_at ? new Date(r.approved_at).toLocaleString() : <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.notes ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={13}>Kayıt bulunamadı</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
