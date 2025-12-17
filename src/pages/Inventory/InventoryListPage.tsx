// src/pages/Inventory/InventoryListPage.tsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import api from "../../services/api";
import * as XLSX from "xlsx";

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => ({
    Tip: r.item_type === "product" ? "Ürün" : "Komponent",
    Barkod: r.barcode,
    Tanım: r.name ?? "",
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

type ItemType = "product" | "component";

type Row = {
  item_type: ItemType;
  item_id: number;
  barcode: string;
  name: string | null;
  unit: string | null;
  quantity: number;
  status_id: number;
  status_label: string;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  updated_at?: string | null;
};

type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };

const TYPE_OPTIONS = [
  { value: "all",       label: "Tümü" },
  { value: "component", label: "Komponent" },
  { value: "product",   label: "Ürün" },
];

export default function InventoryListPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState<number>(0);

  // filtreler
  const [q, setQ] = useState("");
  const [type, setType] = useState<string>("all");
  const [warehouseId, setWarehouseId] = useState<string>("");
  const [locationId, setLocationId] = useState<string>("");

  // lookups
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] =
    useState<Record<number, Location[]>>({});

  const [loading, setLoading] = useState(false);

  /* ------------ Lookups ------------ */
  useEffect(() => {
    api
      .get("/lookups/warehouses")
      .then((r) => setWarehouses(r.data || []))
      .catch((e) => console.error("warehouses error:", e));
  }, []);

  const ensureLocations = async (wh: string | number) => {
    const id = Number(wh || 0);
    if (!id || locationsByWarehouse[id]) return;
    try {
      const { data } = await api.get("/lookups/locations", {
        params: { warehouseId: id },
      });
      setLocationsByWarehouse((prev) => ({ ...prev, [id]: data || [] }));
    } catch (e) {
      console.error("locations error:", e);
    }
  };

  /* ------------ Options ------------ */
  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "Depo (Tümü)" },
      ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [warehouses],
  );

  const locationOptions = useMemo(() => {
    const list = warehouseId
      ? locationsByWarehouse[Number(warehouseId)] || []
      : [];
    return [
      { value: "", label: "Lokasyon (Tümü)" },
      ...list.map((l) => ({ value: String(l.id), label: l.name })),
    ];
  }, [warehouseId, locationsByWarehouse]);

  /* ------------ Fetch (override destekli) ------------ */
  const fetchData = async (overrides?: {
    q?: string;
    type?: string;
    warehouseId?: string;
    locationId?: string;
  }) => {
    const _q = overrides?.q ?? q;
    const _type = overrides?.type ?? type;
    const _wh = overrides?.warehouseId ?? warehouseId;
    const _lc = overrides?.locationId ?? locationId;

    setLoading(true);
    try {
      const res = await api.get("/inventory", {
        params: {
          search: _q || undefined,
          type: _type || "all",
          warehouseId: _wh || undefined,
          locationId: _lc || undefined,
          // statusId GÖNDERMİYORUZ; BE inStockOnly ile 1'e sabitliyor.
          limit: 200,
          offset: 0,
        },
      });

      const items = (res.data?.items || res.data?.rows || []) as Row[];
      setRows(items);
      setTotal(Number(res.data?.total || items.length || 0));
    } catch (e) {
      console.error("inventory fetch error:", e);
      setRows([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------ Handlers ------------ */
  const handleReset = () => {
    setQ("");
    setType("all");
    setWarehouseId("");
    setLocationId("");
    fetchData({ q: "", type: "all", warehouseId: "", locationId: "" });
  };

  /* ------------ Render helpers ------------ */
  const toDetailsHref = (r: Row) =>
    r.item_type === "product"
      ? `/details/product/${r.item_id}`
      : `/details/component/${r.item_id}`;

  const prettyDate = (v?: string | null) =>
    v ? (
      new Date(v).toLocaleString()
    ) : (
      <span className="text-gray-400 dark:text-gray-500">—</span>
    );

      const normalizeUnit = (u?: string | null): "area" | "weight" | "length" | "unit" | "" => {
    const x = String(u || "").trim().toLowerCase();
    if (x === "area") return "area";
    if (x === "weight") return "weight";
    if (x === "length") return "length";
    if (x === "unit") return "unit";
    // bazen BE "EA" falan dönerse yakala:
    if (x === "ea") return "unit";
    return "";
  };

  const unitLabelTR = (u?: string | null) => {
    const k = normalizeUnit(u);
    if (k === "area") return "Alan";
    if (k === "weight") return "Ağırlık";
    if (k === "length") return "Uzunluk";
    if (k === "unit") return "Adet";
    return "—";
  };

  const unitSuffix = (u?: string | null) => {
    const k = normalizeUnit(u);
    if (k === "area") return "(m2)";
    if (k === "weight") return "(kg)";
    if (k === "length") return "(m)";
    if (k === "unit") return "(EA)";
    return "";
  };

  const fmtQtyWithUnit = (r: Row) => {
    if (typeof r.quantity !== "number") return null;
    const suf = unitSuffix(r.unit);
    return (
      <span className="whitespace-nowrap">
        {r.quantity} {suf}
      </span>
    );
  };

  /* ------------ UI ------------ */
  return (
    <div className="space-y-6">
      <PageMeta
        title="Depo Stok | TailAdmin"
        description="Depoda olan stok listesi (Ürün + Komponent)"
      />
      <PageBreadcrumb pageTitle="Depo Stok" />

      {/* Filtreler */}
      <ComponentCard title="Filtreler">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-7">
          <Input
            placeholder="Ara (barkod, tanım…)"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Select
            options={TYPE_OPTIONS}
            value={type}
            onChange={setType}
            placeholder="Tip"
          />
          <Select
            options={warehouseOptions}
            value={warehouseId}
            onChange={async (v: string) => {
              setWarehouseId(v);
              setLocationId("");
              if (v) await ensureLocations(v);
            }}
            placeholder="Depo"
          />
          <Select
            options={locationOptions}
            value={locationId}
            onChange={setLocationId}
            placeholder="Lokasyon"
          />

          <div className="flex">
            <Button
              variant="primary"
              onClick={() => fetchData()}
              className="w-full h-11 whitespace-nowrap"
            >
              Uygula
            </Button>
          </div>

          <div className="flex">
            <Button
              variant="primary"
              onClick={handleReset}
              className="w-full h-11 whitespace-nowrap"
            >
              Sıfırla
            </Button>
          </div>

          <div className="flex">
            <Button
              variant="primary"
              onClick={() => exportToExcel(rows)}
              className="w-full h-11 whitespace-nowrap"
            >
              Excel’e Aktar
            </Button>
          </div>
        </div>
      </ComponentCard>

      {/* Tablo */}
      <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-gray-900">
        <div className="overflow-x-auto scroll-area">
          <table className="w-full text-sm text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="text-left">
                {[
                  "Tip",
                  "Barkod",
                  "Tanım",
                  "Birim",
                  "Miktar",
                  "Depo",
                  "Lokasyon",
                  "Durum",
                  "Güncelleme",
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
                    colSpan={9}
                  >
                    Yükleniyor…
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((r) => (
                  <tr
                    key={`${r.item_type}-${r.item_id}`}
                    className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-white/5"
                  >
                    <td className="px-4 py-3">
                      {r.item_type === "product" ? "Ürün" : "Komponent"}
                    </td>

                    <td className="px-4 py-3">
                      <Link
                        to={toDetailsHref(r)}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.barcode}
                      </Link>
                    </td>

                    <td className="px-4 py-3 min-w-[240px]">
                      {r.name ? (
                        <Link
                          to={toDetailsHref(r)}
                          className="text-brand-600 hover:underline dark:text-brand-400"
                        >
                          {r.name}
                        </Link>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {unitLabelTR(r.unit) !== "—" ? (
                        unitLabelTR(r.unit)
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {typeof r.quantity === "number" ? (
                        fmtQtyWithUnit(r)
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.warehouse_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {r.location_name ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      {r.status_label ?? (
                        <span className="text-gray-400 dark:text-gray-500">
                          —
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{prettyDate(r.updated_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={9}
                  >
                    Kayıt bulunamadı
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
          <span>Toplam: {total}</span>
          <span>Gösterilen: {rows.length}</span>
        </div>
      </div>
    </div>
  );
}
