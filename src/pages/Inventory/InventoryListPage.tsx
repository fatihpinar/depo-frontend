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

/* ================== AUTH HELPERS ================== */

type JwtPayload = {
  sub?: number | string;
  role?: string; // role_key
  role_id?: number; // varsa en sağlamı
  [k: string]: any;
};

function safeParseJwtPayload(): JwtPayload | null {
  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const base64 = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );

    return JSON.parse(json);
  } catch {
    return null;
  }
}

// Sadece admin(1) + depo yöneticisi(2) detay sayfalarına tıklayabilir
function canClickDetails(): boolean {
  const p = safeParseJwtPayload();
  if (!p) return false;

  const roleId = Number(p.role_id);
  if (Number.isFinite(roleId) && roleId > 0) {
    return roleId === 1 || roleId === 2;
  }

  const roleKey = (p.role || "").toString();
  return roleKey === "admin" || roleKey === "warehouse_manager";
}

/* ================== TYPES & HELPERS ================== */

type ItemType = "product" | "component";

function normalizeUnit(
  u?: string | null
): "area" | "weight" | "length" | "unit" | "box_unit" | "volume" | "" {
  const x = String(u || "").trim().toLowerCase();
  if (x === "area") return "area";
  if (x === "weight") return "weight";
  if (x === "length") return "length";
  if (x === "box_unit") return "box_unit";
  if (x === "volume") return "volume";
  if (x === "unit" || x === "ea") return "unit";
  return "";
}

type Row = {
  item_type: ItemType;
  item_id: number;
  barcode: string;
  name: string | null;
  unit: string | null;
  quantity: number;

  width?: number | null;
  height?: number | null;
  weight?: number | null;
  length?: number | null;
  area?: number | null;
  volume?: number | null;

  entry_type?: "count" | "purchase" | null;
  box_unit?: number | null;

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
  { value: "all", label: "Tümü" },
  { value: "component", label: "Komponent" },
  { value: "product", label: "Ürün" },
];

/* ================== EXCEL EXPORT ================== */

function exportToExcel(rows: Row[]) {
  const data = rows.map((r) => {
    const k = normalizeUnit(r.unit);

    const en =
      r.item_type === "component" && k === "area" ? (r.width ?? "") : "";
    const boy =
      r.item_type === "component" && k === "area" ? (r.height ?? "") : "";

    return {
      Tip: r.item_type === "product" ? "Ürün" : "Komponent",
      Barkod: r.barcode,
      Tanım: r.name ?? "",
      Birim: r.unit ?? "",
      En: en,
      Boy: boy,
      Miktar: typeof r.quantity === "number" ? r.quantity : "",
      Depo: r.warehouse_name ?? "",
      Lokasyon: r.location_name ?? "",
      Durum: r.status_label ?? "",
      Güncelleme: r.updated_at ? new Date(r.updated_at).toLocaleString() : "",
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, "Depo Stok");
  XLSX.writeFile(wb, "depo-stok.xlsx");
}

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
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<
    Record<number, Location[]>
  >({});

  const [loading, setLoading] = useState(false);

  // ✅ sadece admin+depo yöneticisi tıklayabilir
  const allowClick = canClickDetails();

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
    [warehouses]
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

  /* ------------ Fetch ------------ */
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
  const dash = <span className="text-gray-400 dark:text-gray-500">—</span>;

  const entryTypeLabelTR = (v?: string | null) => {
    if (v === "count") return "Sayım";
    if (v === "purchase") return "Satın Alma";
    return "—";
  };

  const renderEntryType = (r: Row) => {
    if (r.item_type !== "component") return dash;
    return entryTypeLabelTR(r.entry_type);
  };

  const renderWidth = (r: Row) =>
    r.item_type === "component" && normalizeUnit(r.unit) === "area"
      ? r.width ?? dash
      : dash;

  const renderHeight = (r: Row) =>
    r.item_type === "component" && normalizeUnit(r.unit) === "area"
      ? r.height ?? dash
      : dash;

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

  const unitLabelTR = (u?: string | null) => {
    const k = normalizeUnit(u);
    if (k === "area") return "Alan (m²)";
    if (k === "weight") return "Ağırlık (kg)";
    if (k === "length") return "Uzunluk (m)";
    if (k === "unit") return "Adet (EA)";
    if (k === "box_unit") return "Koli İçi Adet (ea)";
    if (k === "volume") return "Hacim (lt)";
    return "—";
  };

  const unitSuffix = (u?: string | null) => {
    const k = normalizeUnit(u);
    if (k === "area") return "(m2)";
    if (k === "weight") return "(kg)";
    if (k === "length") return "(m)";
    if (k === "unit") return "(EA)";
    if (k === "box_unit") return "(ea)";
    if (k === "volume") return "(lt)";
    return "";
  };

  const getComponentQty = (r: Row): number | null => {
  const k = normalizeUnit(r.unit);

  if (k === "area") {
    if (typeof r.area === "number") return r.area;
    const w = typeof r.width === "number" ? r.width : null;
    const h = typeof r.height === "number" ? r.height : null;
    return w !== null && h !== null ? w * h : null;
  }

  if (k === "weight") return typeof r.weight === "number" ? r.weight : null;
  if (k === "length") return typeof r.length === "number" ? r.length : null;
  if (k === "volume") return typeof r.volume === "number" ? r.volume : null;
  if (k === "box_unit") return typeof r.box_unit === "number" ? r.box_unit : null;

  // unit/ea ise satır adedi mantığı (bu endpointte quantity zaten var)
  return typeof r.quantity === "number" ? r.quantity : null;
};

const fmtQtyWithUnit = (r: Row) => {

  // product -> quantity
  if (r.item_type === "product") {
    if (typeof r.quantity !== "number") return dash;
    return (
      <span className="whitespace-nowrap">
        {r.quantity} {unitSuffix(r.unit)}
      </span>
    );
  }

  // component -> unit'e göre alan/agirlik/uzunluk/hacim/...
  const val = getComponentQty(r);
  if (val === null) return dash;

  return (
    <span className="whitespace-nowrap">
      {val} {unitSuffix(r.unit)}
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
          <table className="w-full min-w-max text-sm text-gray-700 dark:text-gray-200">
            <thead>
              <tr className="text-left">
                {[
                  "Tip",
                  "Barkod",
                  "Tanım",
                  "Giriş Tipi",
                  "Birim",
                  "Miktar",
                  "En (m)",
                  "Boy (m)",
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
                    colSpan={12}
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

                    {/* ✅ Barkod: sadece allowClick ise link */}
                    <td className="px-4 py-3">
                      <Link
                        to={toDetailsHref(r)}
                        className="text-brand-600 hover:underline dark:text-brand-400"
                      >
                        {r.barcode}
                      </Link>
                    </td>

                    {/* ✅ Tanım: sadece allowClick ise link */}
                    <td className="px-4 py-3 min-w-[240px]">
                      {r.name ? (
                        allowClick ? (
                          <Link
                            to={toDetailsHref(r)}
                            className="text-brand-600 hover:underline dark:text-brand-400"
                          >
                            {r.name}
                          </Link>
                        ) : (
                          <span className="text-gray-800 dark:text-gray-100">
                            {r.name}
                          </span>
                        )
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3">{renderEntryType(r)}</td>

                    <td className="px-4 py-3">
                      {unitLabelTR(r.unit) !== "—" ? unitLabelTR(r.unit) : dash}
                    </td>

                    <td className="px-4 py-3">{fmtQtyWithUnit(r)}</td>

                    <td className="px-4 py-3">{renderWidth(r)}</td>
                    <td className="px-4 py-3">{renderHeight(r)}</td>

                    <td className="px-4 py-3">{r.warehouse_name ?? dash}</td>
                    <td className="px-4 py-3">{r.location_name ?? dash}</td>
                    <td className="px-4 py-3">{r.status_label ?? dash}</td>
                    <td className="px-4 py-3">{prettyDate(r.updated_at)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    className="px-4 py-6 text-gray-500 dark:text-gray-400"
                    colSpan={12}
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