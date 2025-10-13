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
    Tanım: r.display_label ?? "",
    Birim: r.unit ?? "",
    Miktar: r.quantity ?? "",
    Depo: r.warehouse_name ?? "",
    Lokasyon: r.location_name ?? "",
    Durum: r.status_label ?? "",
    Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, "depo-stok.xlsx");
}



type Row = {
  // pm.* (backend zaten SELECT pm.* yapıyor)
  id: number;
  category_id?: number;
  type_id?: number;
  supplier_id?: number;
  supplier_product_code?: string | null;
  name?: string | null;
  color_pattern?: string | null;
  thickness?: number | null;
  width?: number | null;
  density?: number | null;
  bimeks_code?: string | null;
  weight?: number | null;
  unit_kind?: string | null;            // "count" | "length" | "weight" vs.
  default_unit?: "EA" | "M" | "KG" | ""; // db text olabilir
  created_at?: string;
  updated_at?: string;

  // JOIN alanları
  display_label: string;
  category_name?: string;
  type_name?: string;
  supplier_name?: string;
};

export default function MasterListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [typeId, setTypeId] = useState<string>("");
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/masters", {
        params: {
          search: q || undefined,
          categoryId: categoryId || undefined,
          typeId: typeId || undefined,
        },
      });
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const [categories, setCategories] = useState<{ id:number; name:string }[]>([]);
  const [types, setTypes] = useState<{ id:number; name:string }[]>([]);

  useEffect(() => { api.get("/categories").then(r=>setCategories(r.data||[])); }, []);
  useEffect(() => {
    const cid = Number(categoryId || 0);
    if (!cid) { setTypes([]); setTypeId(""); return; }
    api.get(`/types/${cid}`).then(r=>setTypes(r.data||[]));
  }, [categoryId]);

  const categoryOptions = useMemo(()=>[
    { value:"", label:"Kategori (tümü)" },
    ...categories.map(c=>({ value:String(c.id), label:c.name })),
  ], [categories]);

  const typeOptions = useMemo(()=>[
    { value:"", label:"Tür (tümü)" },
    ...types.map(t=>({ value:String(t.id), label:t.name })),
  ], [types]);

  return (
    <div className="space-y-6">
      <PageMeta title="Tanım Listesi | TailAdmin" description="Master tanımları" />
      <PageBreadcrumb pageTitle="Tanım Listesi" />

      {/* Filtreler değişmedi */}
      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_auto]">
          <Input placeholder="Ara (label, tedarikçi…)" value={q} onChange={(e)=>setQ(e.target.value)} />
          <Select options={categoryOptions} value={categoryId} onChange={setCategoryId} placeholder="Kategori" />
          <Select options={typeOptions} value={typeId} onChange={setTypeId} placeholder="Tür" />
        </div>
        <div className="mt-4 flex gap-2">
          <Button variant="primary" onClick={fetchData}>Uygula</Button>
          <Button variant="outline" onClick={()=>{ setQ(""); setCategoryId(""); setTypeId(""); fetchData(); }}>Sıfırla</Button>
          <Button variant="primary" onClick={() => exportToExcel(rows)}>
            Excel’e Aktar
          </Button>
        </div>
      </ComponentCard>

      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto">
          {/* 👇 temel metin rengi (light/dark) */}
          <table className="w-full text-sm text-gray-700 dark:text-gray-200">
            <thead>
              {/* 👇 başlıklar ikincil ton */}
              <tr className="text-left">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tanım</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kategori</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tür</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tedarikçi</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tedarikçi Ürün Kodu</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Renk/Desen</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Kalınlık</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">En</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Yoğunluk</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Bimeks Kodu</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Ağırlık</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Birim Türü</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Ölçü Birimi</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Oluşturma</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Güncelleme</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  {/* 👇 boş/yardımcı metin rengi */}
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={17}>
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map(r => (
                  <tr
                    key={r.id}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3 min-w-[240px]">
                      {/* 👇 link rengi için light/dark */}
                      <Link
                      to={`/details/master/${r.id}`}
                      className="text-brand-600 hover:underline dark:text-brand-400"
                    >
                      {r.display_label || <span className="text-gray-400 dark:text-gray-500">—</span>}
                    </Link>

                    </td>
                    <td className="px-4 py-3">{r.category_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.type_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.supplier_name ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.supplier_product_code ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.color_pattern ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.thickness ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.width ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.density ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.bimeks_code ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.weight ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.unit_kind ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.default_unit ?? <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.created_at ? new Date(r.created_at).toLocaleString() : <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                    <td className="px-4 py-3">{r.updated_at ? new Date(r.updated_at).toLocaleString() : <span className="text-gray-400 dark:text-gray-500">—</span>}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-6 text-gray-500 dark:text-gray-400" colSpan={17}>
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