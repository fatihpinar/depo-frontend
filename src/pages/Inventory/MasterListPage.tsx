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

/* ================== EXCEL EXPORT ================== */
const UNIT_LABEL_MAP: Record<string, string> = {
  length: "length (m)",
  unit: "unit (EA)",
  weight: "weight (kg)",
  area: "area (m²)",
};

function toNumberSafe(v: any) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatUnitForExcel(unit?: string | null) {
  if (!unit) return "";
  return UNIT_LABEL_MAP[unit] ?? unit;
}

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => ({
    "Bimeks Kodu": r.bimeks_code ?? "",
    "Bimeks Ürün Tanımı": r.bimeks_product_name ?? "",

    // ✅ Tek kolonda: length (m) / area (m²) / weight (kg) / unit (EA)
    "Ölçü Birimi": formatUnitForExcel(r.stock_unit),

    // ✅ SADE SAYI (Excel için birim yok)
    "Toplam Miktar": toNumberSafe(r.total_qty),

    "Toplam Adet": toNumberSafe(r.total_count),

    "Ürün Türü": r.product_type_name ?? "",
    "Taşıyıcı Türü": r.carrier_type_name ?? "",
    "Tedarikçi": r.supplier_name ?? "",
    "Tedarikçi Ürün Kodu": r.supplier_product_code ?? "",
    "Taşıyıcı Renk": r.carrier_color_name ?? "",
    "Liner Renk": r.liner_color_name ?? "",
    "Liner Türü": r.liner_type_name ?? "",
    "Yapışkan Türü": r.adhesive_type_name ?? "",
    "Kalınlık": r.thickness ?? "",
    "Taşıyıcı Yoğunluk": r.carrier_density ?? "",

    // ✅ Tarihler (UI gibi)
    "Oluşturma": r.created_at ? new Date(r.created_at).toLocaleString() : "",
    "Güncelleme": r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Master Tanımlar");
  XLSX.writeFile(wb, "master-tanimlar.xlsx");
}

/* ================== TYPES ================== */

type Lookup = {
  id: number;
  name: string;
  display_code?: string | null;
};

type Row = {

  id: number;
  bimeks_code: string | null;
  bimeks_product_name: string | null;
  stock_unit?: "area" | "weight" | "length" | "unit" | null;
  total_count?: number | string | null; // ✅ toplam adet
  total_qty?: number | string | null;   // ✅ toplam miktar
  product_type_id: number;
  carrier_type_id: number | null;
  supplier_id: number;
  supplier_product_code: string | null;
  thickness: number | null;
  carrier_density: number | null;
  carrier_color_id: number | null;
  liner_color_id: number | null;
  liner_type_id: number | null;
  adhesive_type_id: number | null;

  created_at?: string;
  updated_at?: string;

  product_type_name?: string | null;
  carrier_type_name?: string | null;
  supplier_name?: string | null;
  carrier_color_name?: string | null;
  liner_color_name?: string | null;
  liner_type_name?: string | null;
  adhesive_type_name?: string | null;

  total_unit_count?: number | string | null;
  total_area_sum?: number | string | null;
};

export default function MasterListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState("");

  const [productTypeId, setProductTypeId] = useState<string>("");
  const [supplierId, setSupplierId] = useState<string>("");

  const [loading, setLoading] = useState(false);

  const [productTypes, setProductTypes] = useState<Lookup[]>([]);
  const [suppliers, setSuppliers] = useState<Lookup[]>([]);
  const unitLabel = (u?: string | null) => {
    if (u === "area") return "Alan (m²)";
    if (u === "weight") return "Ağırlık (kg)";
    if (u === "length") return "Uzunluk (m)";
    if (u === "unit") return "Adet";
    return "—";
  };

  const unitSuffix = (u?: string | null) => {
    if (u === "area") return "m²";
    if (u === "weight") return "kg";
    if (u === "length") return "m";
    if (u === "unit") return "EA";
    return "";
  };

  const formatQty = (val: any) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("tr-TR", { maximumFractionDigits: 3 });
  };

  /* ========== DATA FETCH ========== */

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get("/masters", {
        params: {
          search: q || undefined,
          productTypeId: productTypeId || undefined,
          supplierId: supplierId || undefined,
        },
      });
      setRows(res.data || []);
    } finally {
      setLoading(false);
    }
  };

  // ilk yüklemede: master listesi + lookuplar
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [mastersRes, ptRes, supRes] = await Promise.all([
          api.get("/masters"),
          api.get("/lookups/product-types"),
          api.get("/lookups/suppliers"),
        ]);
        setRows(mastersRes.data || []);
        setProductTypes(ptRes.data || []);
        setSuppliers(supRes.data || []);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ========== OPTIONS ========== */

  const productTypeOptions = useMemo(
    () => [
      { value: "", label: "Ürün Türü (tümü)" },
      ...productTypes.map((p) => ({
        value: String(p.id),
        label: p.name,
      })),
    ],
    [productTypes]
  );

  const supplierOptions = useMemo(
    () => [
      { value: "", label: "Tedarikçi (tümü)" },
      ...suppliers.map((s) => ({
        value: String(s.id),
        label: s.name,
      })),
    ],
    [suppliers]
  );

  const formatInt = (val: any) => {
    const n = Number(val);
    if (!Number.isFinite(n)) return "0";
    return n.toLocaleString("tr-TR", {
      maximumFractionDigits: 0, // 🔹 tam sayı
    });
  };

  /* ========== UI ========== */

  return (
    <div className="space-y-6">
      <PageMeta
        title="Tanım Listesi | TailAdmin"
        description="Master tanımları"
      />
      <PageBreadcrumb pageTitle="Tanım Listesi" />

      {/* Filtreler */}
      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Input
            placeholder="Ara (Bimeks kodu, ürün adı, tedarikçi…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            options={productTypeOptions}
            value={productTypeId}
            onChange={setProductTypeId}
            placeholder="Ürün Türü"
          />
          <Select
            options={supplierOptions}
            value={supplierId}
            onChange={setSupplierId}
            placeholder="Tedarikçi"
          />
          <div className="flex gap-2">
            <Button variant="primary" onClick={fetchData}>
              Uygula
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setQ("");
                setProductTypeId("");
                setSupplierId("");
                fetchData();
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
                  Bimeks Kodu
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Bimeks Ürün Tanımı
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Ölçü Birimi
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Toplam Adet
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Toplam Miktar
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Ürün Türü
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Taşıyıcı Türü
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Tedarikçi
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Tedarikçi Ürün Kodu
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Taşıyıcı Renk
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Liner Renk
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Liner Türü
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Yapışkan Türü
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Kalınlık
                </th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">
                  Taşıyıcı Yoğunluk
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
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={14}
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
                        to={`/details/master/${r.id}`}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.bimeks_code ?? (
                          <span className="text-gray-400 dark:text-gray-500">
                            —
                          </span>
                        )}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      {r.bimeks_product_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {unitLabel(r.stock_unit)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {formatInt(r.total_count)}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {formatQty(r.total_qty)} {unitSuffix(r.stock_unit)}
                    </td>

                    <td className="px-4 py-3">
                      {r.product_type_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.carrier_type_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.supplier_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.supplier_product_code ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.carrier_color_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.liner_color_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.liner_type_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.adhesive_type_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.thickness ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.carrier_density ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.created_at ? (
                        new Date(r.created_at).toLocaleString()
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.updated_at ? (
                        new Date(r.updated_at).toLocaleString()
                      ) : (
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
                    colSpan={14}
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
