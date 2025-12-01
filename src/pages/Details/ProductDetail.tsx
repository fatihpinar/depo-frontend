// src/pages/Details/ProductDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";

/* ---------- Helpers ---------- */
const safeRandomId = () =>
  (globalThis as any)?.crypto?.randomUUID?.() ??
  "id_" + Math.random().toString(36).slice(2, 10);
const humanize = (s: string) => String(s).replace(/_/g, " ");

/* ---------- Lookups ---------- */
type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };

/* ---------- Status ---------- */
type StatusOpt = { value: number; label: string };

/* ---------- Product comp rows ---------- */
type ProductCompRow = {
  id: number; // component id
  barcode: string;
  unit: string;
  master: { id: number; name: string | null };
  consume_qty: number;
  link_id?: number;
};

/* ---------- İade (Kaldırılacaklar) ---------- */
type RemovalRow = {
  link_id?: number;
  component_id: number;
  barcode: string;
  unit: string;
  master_name: string | null;
  original_consume: number;
  return_qty?: number;
  new_barcode?: string;
  warehouse_id?: number | "";
  location_id?: number | "";
};

/* ---------- Hurda (FIRE) ---------- */
type ScrapRow = {
  link_id?: number;
  component_id: number;
  barcode: string;
  unit: string;
  master_name: string | null;
  original_consume: number;
  fire_qty?: number; // EA ise UI'da 1 sabit gösterilecek
  reason?: string;
};

/* ---------- Stoktaki component picker satırı ---------- */
type StockRow = {
  id: number;
  barcode: string;
  name: string;
  unit: "EA" | "M" | "KG" | string;
  quantity: number;
  warehouse: { id: number; name: string };
  location: { id: number; name: string };
};
type AddRow = {
  key: string;
  stock?: StockRow;
  consumeQty?: number;
  open?: boolean;
};

/* ---------- Timeline ---------- */
type TransitionRow = {
  id: number;
  item_type: "component" | "product";
  item_id: number;
  action:
    | "CREATE"
    | "APPROVE"
    | "ASSEMBLE_PRODUCT"
    | "CONSUME"
    | "RETURN"
    | "MOVE"
    | "STATUS_CHANGE"
    | "ADJUST"
    | "ATTRIBUTE_CHANGE";
  qty_delta?: number | null;
  unit?: string | null;
  from_status_id?: number | null;
  to_status_id?: number | null;
  from_status_label?: string | null;
  to_status_label?: string | null;
  from_warehouse_id?: number | null;
  to_warehouse_id?: number | null;
  from_warehouse_name?: string | null;
  to_warehouse_name?: string | null;
  from_location_id?: number | null;
  to_location_id?: number | null;
  from_location_name?: string | null;
  to_location_name?: string | null;
  created_at: string;
  notes?: string | null;
  meta?: any;
};

export default function ProductDetailPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const id = Number(rawId || 0);

  const [loading, setLoading] = useState(true);

  /* ------ lookups ------ */
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] =
    useState<Record<number, Location[]>>({});

  /* ------ ortak state’ler (ürün) ------ */
  const [barcode, setBarcode] = useState("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [bimeksCode, setBimeksCode] = useState("");
  const [productName, setProductName] = useState("");

  /* ------ product özel ------ */
  const [components, setComponents] = useState<ProductCompRow[]>([]);
  const isProductDepotEditable = statusId === 1 || statusId === 4;

  /* ------ add rows (product’a comp ekleme) ------ */
  const [addRows, setAddRows] = useState<AddRow[]>([]);
  const [addSearch, setAddSearch] = useState<Record<string, string>>({});
  const [addChoices, setAddChoices] = useState<Record<string, StockRow[]>>({});

  /* ------ İade & Hurda state ------ */
  const [removals, setRemovals] = useState<RemovalRow[]>([]);
  const [scraps, setScraps] = useState<ScrapRow[]>([]);

  /* ------ seçenekler ------ */
  const warehouseOptions = useMemo(
    () => [
      { value: "", label: "Seçiniz", disabled: true },
      ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
    ],
    [warehouses]
  );
  const locationOptions = useMemo(() => {
    const list = warehouseId
      ? locationsByWarehouse[Number(warehouseId)] || []
      : [];
    return [
      { value: "", label: "Seçiniz", disabled: true },
      ...list.map((l) => ({ value: String(l.id), label: l.name })),
    ];
  }, [warehouseId, locationsByWarehouse]);

  /* ------ helpers ------ */
  const ensureLocations = async (wh: number | "") => {
    const w = Number(wh || 0);
    if (!w || locationsByWarehouse[w]) return;
    try {
      const { data } = await api.get(`/lookups/locations`, {
        params: { warehouseId: w },
      });
      setLocationsByWarehouse((prev) => ({ ...prev, [w]: data || [] }));
    } catch (e) {
      console.error("locations load error", e);
    }
  };

  const loadAddChoices = async (rowKey: string, q: string) => {
    try {
      const res = await api.get("/components", {
        params: { search: q || undefined, availableOnly: true },
      });
      const items: StockRow[] = (res.data || []).map((r: any) => ({
        id: r.id,
        barcode: r.barcode,
        unit: r.unit,
        quantity: r.quantity,
        name: r.master?.display_label || r.master?.name || r.name,
        warehouse: r.warehouse || { id: 0, name: "-" },
        location: r.location || { id: 0, name: "-" },
      }));
      setAddChoices((prev) => ({ ...prev, [rowKey]: items }));
    } catch (e) {
      console.error("components fetch error:", e);
      setAddChoices((prev) => ({ ...prev, [rowKey]: [] }));
    }
  };

  const selectedAddIds = useMemo(
    () => addRows.map((r) => r.stock?.id).filter(Boolean) as number[],
    [addRows]
  );
  const addAddRow = () => {
    const key = safeRandomId();
    setAddRows((p) => [...p, { key, open: false }]);
    setAddSearch((s) => ({ ...s, [key]: "" }));
  };
  const toggleAddDropdown = (idx: number, open?: boolean) => {
    setAddRows((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, open: open ?? !r.open } : { ...r, open: false }
      )
    );
    const row = addRows[idx];
    if (row) {
      const q = addSearch[row.key] ?? "";
      loadAddChoices(row.key, q);
    }
  };
  const chooseAddComponent = (idx: number, row: StockRow) => {
    setAddRows((prev) =>
      prev.map((r, i) =>
        i === idx
          ? {
              ...r,
              stock: row,
              consumeQty: row.unit === "EA" ? undefined : r.consumeQty,
              open: false,
            }
          : r
      )
    );
  };
  const setAddQty = (key: string, val: string) => {
    setAddRows((prev) =>
      prev.map((r) =>
        r.key !== key
          ? r
          : {
              ...r,
              consumeQty:
                r.stock?.unit === "EA"
                  ? undefined
                  : Math.max(0, Number(val || 0)),
            }
      )
    );
  };
  const removeAddRow = (key: string) => {
    setAddRows((prev) => prev.filter((r) => r.key !== key));
    setAddSearch((s) => {
      const n = { ...s };
      delete n[key];
      return n;
    });
    setAddChoices((c) => {
      const n = { ...c } as any;
      delete n[key];
      return n;
    });
  };
  const addRowsValid =
    addRows.length > 0 &&
    addRows.every((r) => {
      if (!r.stock) return false;
      if (r.stock.unit === "EA") return true;
      const q = Number(r.consumeQty || 0);
      return q > 0 && q <= (r.stock?.quantity ?? 0);
    });

  /* ------ lookups yükle ------ */
  useEffect(() => {
    (async () => {
      try {
        const whRes = await api.get("/lookups/warehouses");
        setWarehouses(whRes.data || []);

        // Statüler için BE varsa onu kullan, yoksa fallback
        try {
          const st = await api.get("/lookups/statuses");
          const rows: StatusOpt[] =
            (st.data || []).map((s: any) => ({
              value: Number(s.id),
              label: String(s.label ?? s.code),
            })) ?? [];
          if (rows.length) setStatuses(rows);
        } catch {
          setStatuses([
            { value: 1, label: "Depoda" },
            { value: 2, label: "Kullanıldı" },
            { value: 3, label: "Satıldı" },
            { value: 4, label: "Beklemede" },
            { value: 5, label: "Hasarlı/Kayıp" },
            { value: 6, label: "Üretimde" },
            { value: 7, label: "Serigrafide" },
          ]);
        }
      } catch (e) {
        console.error("lookups error:", e);
      }
    })();
  }, []);

  /* ------ initial product load ------ */
  useEffect(() => {
    if (!id) {
      navigate("/404");
      return;
    }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/products/${id}`);
        setBarcode(data.barcode || "");
        setStatusId(data.status_id || "");
        setWarehouseId(data.warehouse?.id || "");
        if (data.warehouse?.id) await ensureLocations(data.warehouse.id);
        setLocationId(data.location?.id || "");
        setNotes(data.notes || "");
        setComponents((data.components || []) as ProductCompRow[]);
        setBimeksCode(data.bimeks_code || "");
        setProductName(data.product_name || "");
        // recipe_id arka planda kalsın, UI'de göstermiyoruz
      } catch (err) {
        console.error("product details load error:", err);
        alert("Detay yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------ Kaydet (ürün) ------ */
  const handleSave = async () => {
    try {
      const payload: any = {
        barcode,
        bimeks_code: bimeksCode.trim() || null,
        product_name: productName.trim() || null,
        status_id: statusId ? Number(statusId) : undefined,
        warehouse_id:
          isProductDepotEditable && warehouseId ? Number(warehouseId) : null,
        location_id:
          isProductDepotEditable && locationId ? Number(locationId) : null,
        notes: notes.trim() || null,
      };

      await api.put(`/products/${id}`, payload);
      alert("Ürün güncellendi.");
    } catch (err: any) {
      console.error("save error:", err?.response?.data || err);
      alert("Kaydetme hatası.");
    }
  };

  /* ------ product’a component ekleme persist ------ */
  const handleAddPersist = async () => {
    try {
      if (!addRowsValid) return;
      const payload = addRows.map((r) => ({
        component_id: r.stock!.id,
        consume_qty:
          r.stock!.unit === "EA" ? undefined : Number(r.consumeQty || 0),
      }));
      await api.post(`/products/${id}/components/add`, payload);
      const { data } = await api.get(`/products/${id}`);
      setComponents((data.components || []) as ProductCompRow[]);
      setAddRows([]);
      setAddSearch({});
      setAddChoices({});
      alert("Komponent(ler) eklendi.");
    } catch (err: any) {
      console.error("add persist error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "İşlem başarısız.");
    }
  };

  /* ------ Bağlı komponentlerden İADE & HURDA'ya taşıma ------ */
  const moveToRemoval = (row: ProductCompRow) => {
    setComponents((prev) =>
      prev.filter((r) => !(r.id === row.id && r.link_id === row.link_id))
    );
    setRemovals((prev) => [
      ...prev,
      {
        link_id: row.link_id,
        component_id: row.id,
        barcode: row.barcode,
        unit: row.unit,
        master_name: row.master?.name ?? null,
        original_consume: row.consume_qty,
        warehouse_id: "",
        location_id: "",
      },
    ]);
  };

  const moveToScrap = (row: ProductCompRow) => {
    setComponents((prev) =>
      prev.filter((r) => !(r.id === row.id && r.link_id === row.link_id))
    );
    setScraps((prev) => [
      ...prev,
      {
        link_id: row.link_id,
        component_id: row.id,
        barcode: row.barcode,
        unit: row.unit,
        master_name: row.master?.name ?? null,
        original_consume: row.consume_qty,
        fire_qty: row.unit === "EA" ? 1 : row.consume_qty, // default
        reason: "",
      },
    ]);
  };

  /* ------ Toplam kontrolü: aynı link için iade + hurda <= original ------ */
  const totalOveruseError = useMemo(() => {
    // link_id bazında topla
    const byLink: Record<
      string,
      { original?: number; ret?: number; fire?: number }
    > = {};
    removals.forEach((r) => {
      const k = String(r.link_id ?? `${r.component_id}-x`);
      byLink[k] = byLink[k] || {};
      byLink[k].original = r.original_consume;
      const add =
        r.unit === "EA"
          ? r.original_consume || 1
          : Number(r.return_qty ?? 0);
      byLink[k].ret = (byLink[k].ret || 0) + (add || 0);
    });
    scraps.forEach((s) => {
      const k = String(s.link_id ?? `${s.component_id}-x`);
      byLink[k] = byLink[k] || {};
      byLink[k].original = s.original_consume;
      const add = s.unit === "EA" ? 1 : Number(s.fire_qty ?? 0);
      byLink[k].fire = (byLink[k].fire || 0) + (add || 0);
    });
    // ihlal var mı?
    const offenders = Object.values(byLink).filter((v) => {
      const orig = Number(v.original || 0);
      const sum = Number(v.ret || 0) + Number(v.fire || 0);
      return sum > orig + 1e-9; // floating toleransı
    });
    return offenders.length > 0;
  }, [removals, scraps]);

  /* ------ İade Persist ------ */
  const handleRemovalPersist = async () => {
    try {
      if (!removals.length || totalOveruseError) return;
      const items = removals.map((r) => ({
        link_id: r.link_id!,
        component_id: r.component_id,
        new_barcode: (r.new_barcode || "").trim() || undefined,
        return_qty:
          r.unit === "EA" ? undefined : r.return_qty ?? r.original_consume,
        warehouse_id: Number(r.warehouse_id),
        location_id: Number(r.location_id),
      }));
      await api.post(`/products/${id}/components/remove`, items);
      const { data } = await api.get(`/products/${id}`);
      setComponents((data.components || []) as ProductCompRow[]);
      setRemovals([]);
      alert("Komponent(ler) iade edildi.");
    } catch (err: any) {
      console.error("remove persist error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "İşlem başarısız.");
    }
  };

  /* ------ Hurda Persist ------ */
  const handleScrapPersist = async () => {
    try {
      if (!scraps.length || totalOveruseError) return;
      const items = scraps.map((s) => ({
        link_id: s.link_id!,
        component_id: s.component_id,
        is_scrap: true,
        fire_qty:
          s.unit === "EA" ? undefined : s.fire_qty ?? s.original_consume,
        reason: (s.reason || "").trim() || undefined,
      }));
      await api.post(`/products/${id}/components/remove`, items);
      const { data } = await api.get(`/products/${id}`);
      setComponents((data.components || []) as ProductCompRow[]);
      setScraps([]);
      alert("Hurdaya ayırma işlemi kaydedildi.");
    } catch (err: any) {
      console.error("scrap persist error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "İşlem başarısız.");
    }
  };

  /* ------ timeline (product) ------ */
  const [tlLoading, setTlLoading] = useState(false);
  const [tlError, setTlError] = useState<string | null>(null);
  const [tlItems, setTlItems] = useState<TransitionRow[]>([]);
  const [tlTotal, setTlTotal] = useState<number>(0);
  const [tlOffset, setTlOffset] = useState<number>(0);
  const TL_PAGE = 20;

  const fetchTransitions = async (reset = false) => {
    try {
      setTlLoading(true);
      setTlError(null);
      const params = {
        item_type: "product",
        item_id: id,
        limit: TL_PAGE,
        offset: reset ? 0 : tlOffset,
      };
      const { data } = await api.get(`/inventory-transitions`, { params });
      const rows: TransitionRow[] = data?.rows || data || [];
      const total: number = data?.total ?? rows.length;
      setTlItems((prev) => (reset ? rows : [...prev, ...rows]));
      setTlTotal(total);
      setTlOffset((prev) => (reset ? rows.length : prev + rows.length));
    } catch (e: any) {
      console.error("timeline fetch error:", e?.response?.data || e);
      setTlError(e?.response?.data?.message || "Geçmiş yüklenemedi.");
    } finally {
      setTlLoading(false);
    }
  };
  useEffect(() => {
    setTlItems([]);
    setTlOffset(0);
    setTlTotal(0);
    fetchTransitions(true).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "");
  const lineFor = (t: TransitionRow) => {
    const parts: string[] = [];
    parts.push(humanize(t.action));
    if (typeof t.qty_delta === "number" && t.unit) {
      const sign = t.qty_delta > 0 ? "+" : t.qty_delta < 0 ? "−" : "±";
      parts.push(`• ${sign}${Math.abs(t.qty_delta)} ${t.unit}`);
    }
    if (t.from_status_id || t.to_status_id) {
      parts.push(
        `• Durum: ${t.from_status_label ?? "—"} → ${t.to_status_label ?? "—"}`
      );
    }
    if (t.from_warehouse_id || t.to_warehouse_id) {
      parts.push(
        `• Yer: ${t.from_warehouse_name ?? "—"}/${t.from_location_name ?? "—"} → ${
          t.to_warehouse_name ?? "—"
        }/${t.to_location_name ?? "—"}`
      );
    }
    if (t.meta && typeof t.meta === "object") {
      if (t.meta.new_barcode) parts.push(`• Yeni barkod: ${t.meta.new_barcode}`);
      if (t.meta.link_id) parts.push(`• Link: ${t.meta.link_id}`);
    }
    return parts.join("  ");
  };
  const tlHasMore = tlItems.length < tlTotal;

  return (
    <div className="space-y-6">
      <PageMeta title="Ürün Detay" description="Ürün detay sayfası" />
      <PageBreadcrumb pageTitle="Ürün Detay" />

      {loading ? (
        <ComponentCard title="Yükleniyor…">
          <div className="py-6 text-sm text-gray-500">Lütfen bekleyin…</div>
        </ComponentCard>
      ) : (
        <>
          <ComponentCard title="Ürün">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Ürün Adı</Label>
                <Input
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                />
              </div>

              <div>
                <Label>Bimeks Kodu</Label>
                <Input
                  value={bimeksCode}
                  onChange={(e) => setBimeksCode(e.target.value)}
                  placeholder="Opsiyonel"
                />
              </div>

              <div>
                <Label>Barkod</Label>
                <Input
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                />
              </div>

              <div>
                <Label>Durum</Label>
                <Select
                  options={[
                    { value: "", label: "Seçiniz", disabled: true },
                    ...statuses.map((s) => ({
                      value: String(s.value),
                      label: s.label,
                    })),
                  ]}
                  value={statusId ? String(statusId) : ""}
                  onChange={(v: string) => setStatusId(v ? Number(v) : "")}
                />
              </div>

              <div
                className={
                  isProductDepotEditable ? "" : "opacity-60 pointer-events-none"
                }
              >
                <Label>Depo</Label>
                <Select
                  options={warehouseOptions}
                  value={warehouseId ? String(warehouseId) : ""}
                  onChange={async (v: string) => {
                    const next = v ? Number(v) : "";
                    setWarehouseId(next as any);
                    if (v) await ensureLocations(Number(v));
                    setLocationId(""); // depo değişince lokasyonu sıfırla
                  }}
                  placeholder="Seçiniz"
                />
              </div>

              <div
                className={
                  isProductDepotEditable ? "" : "opacity-60 pointer-events-none"
                }
              >
                <Label>Lokasyon</Label>
                <Select
                  options={locationOptions}
                  value={locationId ? String(locationId) : ""}
                  onChange={(v: string) => setLocationId(v ? Number(v) : "")}
                  placeholder="Seçiniz"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Notlar</Label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Opsiyonel"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={handleSave}>
                Kaydet
              </Button>
            </div>
          </ComponentCard>

          {/* PRODUCT: bağlı komponentler + ekleme */}
          <ComponentCard title="Bağlı Komponentler">
            {/* mevcut bağlı komponentler tablosu */}
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-gray-700 dark:text-gray-200">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400">
                    <th className="px-3 py-2">Barkod</th>
                    <th className="px-3 py-2">Tanım</th>
                    <th className="px-3 py-2">Kullanılan Miktar</th>
                    <th className="px-3 py-2">Birim</th>
                    <th className="px-3 py-2">Aksiyon</th>
                  </tr>
                </thead>
                <tbody>
                  {components?.length ? (
                    components.map((c) => (
                      <tr
                        key={`${c.id}-${c.link_id ?? "x"}`}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-3 py-2">{c.barcode}</td>
                        <td className="px-3 py-2">{c.master?.name ?? "-"}</td>
                        <td className="px-3 py-2">{c.consume_qty}</td>
                        <td className="px-3 py-2">{c.unit}</td>
                        <td className="px-3 py-2 flex gap-2">
                          <Button
                            variant="outline"
                            onClick={() => moveToRemoval(c)}
                            disabled={!c.link_id}
                          >
                            Kaldır
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => moveToScrap(c)}
                            disabled={!c.link_id}
                          >
                            Hurdaya Ayır
                          </Button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td className="px-3 py-4 text-gray-500" colSpan={5}>
                        Bağlı komponent yok.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* aynı kart içinde: komponent ekleme alanı */}
            <div className="mt-6 border-t border-gray-100 pt-4 dark:border-gray-800">
              <div className="mb-2 text-sm font-medium text-gray-800 dark:text-gray-100">
                Komponent Ekle
              </div>

              <div className="space-y-4">
                {addRows.map((r, idx) => {
                  const selected = r.stock;
                  const q = addSearch[r.key] ?? "";
                  const all = addChoices[r.key] ?? [];
                  // diğer satırlarda seçilenleri gizle
                  const visible = all.filter(
                    (x) => x.id === selected?.id || !selectedAddIds.includes(x.id)
                  );

                  return (
                    <div
                      key={r.key}
                      className="relative grid items-start gap-3 md:grid-cols-[minmax(260px,1fr)_minmax(160px,220px)_minmax(120px,160px)_auto]"
                      data-comp-picker
                    >
                      {/* Component seçimi */}
                      <div>
                        <Label>Component</Label>
                        <div
                          role="button"
                          tabIndex={0}
                          aria-expanded={r.open ? "true" : "false"}
                          onClick={() => toggleAddDropdown(idx)}
                          className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 text-sm shadow-theme-xs focus:outline-hidden focus:ring-3 cursor-pointer flex items-center justify-between dark:border-gray-700 dark:text-white/90"
                        >
                          <span className="truncate">
                            {selected
                              ? `${selected.barcode} — ${selected.name}`
                              : "Component seçin"}
                          </span>
                          <span className="ml-3 opacity-60">▾</span>
                        </div>

                        {r.open && (
                          <div className="absolute z-20 mt-2 w-[min(920px,92vw)] rounded-xl border border-gray-200 bg-white p-3 shadow-xl dark:border-gray-800 dark:bg-gray-900">
                            <div className="mb-3">
                              <Input
                                placeholder="Ara (barkod / tanım…)"
                                value={q}
                                onChange={(e) => {
                                  const val = e.target.value;
                                  setAddSearch((s) => ({ ...s, [r.key]: val }));
                                  loadAddChoices(r.key, val);
                                }}
                              />
                            </div>

                            <div className="max-h-[320px] overflow-auto">
                              <table className="min-w-[800px] w-full text-sm">
                                <thead>
                                  <tr className="text-left whitespace-nowrap text-gray-600 dark:text-gray-300">
                                    <th className="px-3 py-2">Barkod</th>
                                    <th className="px-3 py-2">Tanım</th>
                                    <th className="px-3 py-2">Birim</th>
                                    <th className="px-3 py-2">Miktar</th>
                                    <th className="px-3 py-2">Depo</th>
                                    <th className="px-3 py-2">Lokasyon</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-gray-800 text-gray-900 dark:text-gray-100">
                                  {visible.length ? (
                                    visible.map((row) => (
                                      <tr
                                        key={row.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-selected={selected?.id === row.id}
                                        onClick={() =>
                                          chooseAddComponent(idx, row)
                                        }
                                        className={`cursor-pointer transition ${
                                          selected?.id === row.id
                                            ? "bg-brand-500/5 dark:bg-brand-500/10"
                                            : "hover:bg-gray-50/70 dark:hover:bg-white/5"
                                        }`}
                                      >
                                        <td className="px-3 py-2">
                                          {row.barcode}
                                        </td>
                                        <td className="px-3 py-2">
                                          {row.name}
                                        </td>
                                        <td className="px-3 py-2">
                                          {row.unit}
                                        </td>
                                        <td className="px-3 py-2">
                                          {row.quantity}
                                        </td>
                                        <td className="px-3 py-2">
                                          {row.warehouse.name}
                                        </td>
                                        <td className="px-3 py-2">
                                          {row.location.name}
                                        </td>
                                      </tr>
                                    ))
                                  ) : (
                                    <tr>
                                      <td
                                        className="px-3 py-6 text-gray-500 dark:text-gray-400"
                                        colSpan={6}
                                      >
                                        Kayıt bulunamadı
                                      </td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="mt-3 flex justify-end">
                              <Button
                                variant="outline"
                                onClick={() => toggleAddDropdown(idx, false)}
                              >
                                Kapat
                              </Button>
                            </div>
                          </div>
                        )}

                        {selected && (
                          <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            Birim: {selected.unit} • Mevcut: {selected.quantity} •{" "}
                            {selected.warehouse.name} / {selected.location.name}
                          </div>
                        )}
                      </div>

                      {/* Miktar */}
                      <div>
                        <Label>Kullanılacak Miktar</Label>
                        {selected?.unit === "EA" ? (
                          <Input disabled value="1" />
                        ) : (
                          <Input
                            type="number"
                            min="0"
                            max={String(selected?.quantity ?? 0)}
                            value={r.consumeQty ?? ""}
                            onChange={(e) => setAddQty(r.key, e.target.value)}
                            placeholder={
                              selected ? `0 - ${selected.quantity}` : ""
                            }
                            disabled={!selected}
                          />
                        )}
                      </div>

                      {/* Birim */}
                      <div className="md:justify-self-start">
                        <Label>Birim</Label>
                        <div className="h-11 flex items-center">
                          <span className="text-sm text-gray-800 dark:text-gray-100">
                            {selected?.unit ?? "—"}
                          </span>
                        </div>
                      </div>

                      {/* Satır kaldır */}
                      <div className="md:justify-self-end">
                        <Label className="invisible">Aksiyon</Label>
                        <div className="h-11 flex items-center">
                          <Button
                            variant="outline"
                            onClick={() => removeAddRow(r.key)}
                          >
                            Kaldır
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="pt-2 flex gap-3">
                  <Button variant="primary" onClick={addAddRow}>
                    Component Ekle
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleAddPersist}
                    disabled={!addRowsValid || addRows.length === 0}
                  >
                    Kaydet
                  </Button>
                </div>
              </div>
            </div>
          </ComponentCard>

          {/* PRODUCT: Kaldırılacaklar (İade) */}
          {removals.length > 0 && (
            <ComponentCard title="Kaldırılacaklar (İade)">
              {totalOveruseError && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                  Uyarı: Aynı komponent için iade + hurda toplamı kullanılan miktardan fazla olamaz.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700 dark:text-gray-200">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Barkod</th>
                      <th className="px-3 py-2">Yeni Barkod (ops.)</th>
                      <th className="px-3 py-2">Tanım</th>
                      <th className="px-3 py-2">Miktar (ops.)</th>
                      <th className="px-3 py-2">Birim</th>
                      <th className="px-3 py-2">Depo</th>
                      <th className="px-3 py-2">Lokasyon</th>
                      <th className="px-3 py-2">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {removals.map((r, idx) => {
                      const locOpts = [
                        { value: "", label: "Seçiniz", disabled: true },
                        ...(
                          r.warehouse_id
                            ? locationsByWarehouse[Number(r.warehouse_id)] || []
                            : []
                        ).map((l) => ({ value: String(l.id), label: l.name })),
                      ];
                      return (
                        <tr
                          key={`ret-${idx}`}
                          className="border-t border-gray-100 dark:border-gray-800"
                        >
                          <td className="px-3 py-2">{r.barcode}</td>
                          <td className="px-3 py-2">
                            <Input
                              value={r.new_barcode || ""}
                              onChange={(e) =>
                                setRemovals((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? { ...x, new_barcode: e.target.value }
                                      : x
                                  )
                                )
                              }
                              placeholder="Opsiyonel"
                            />
                          </td>
                          <td className="px-3 py-2">{r.master_name ?? "-"}</td>
                          <td className="px-3 py-2">
                            <Input
                              type="number"
                              min="0"
                              max={String(r.original_consume)}
                              disabled={r.unit === "EA"}
                              value={
                                r.unit === "EA"
                                  ? r.original_consume
                                  : r.return_qty ?? ""
                              }
                              onChange={(e) =>
                                setRemovals((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          return_qty: Number(
                                            e.target.value || 0
                                          ),
                                        }
                                      : x
                                  )
                                )
                              }
                              placeholder={
                                r.unit === "EA"
                                  ? ""
                                  : `0 - ${r.original_consume}`
                              }
                            />
                          </td>
                          <td className="px-3 py-2">{r.unit}</td>
                          <td className="px-3 py-2 min-w-[160px]">
                            <Select
                              options={warehouseOptions}
                              value={r.warehouse_id ? String(r.warehouse_id) : ""}
                              onChange={async (v: string) => {
                                const wid = v ? Number(v) : "";
                                setRemovals((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? { ...x, warehouse_id: wid, location_id: "" }
                                      : x
                                  )
                                );
                                if (wid) await ensureLocations(wid);
                              }}
                            />
                          </td>
                          <td className="px-3 py-2 min-w-[160px]">
                            <Select
                              options={locOpts}
                              value={r.location_id ? String(r.location_id) : ""}
                              onChange={(v: string) =>
                                setRemovals((prev) =>
                                  prev.map((x, i) =>
                                    i === idx
                                      ? {
                                          ...x,
                                          location_id: v ? Number(v) : "",
                                        }
                                      : x
                                  )
                                )
                              }
                            />
                          </td>
                          <td className="px-3 py-2">
                            <Button
                              variant="outline"
                              onClick={() => {
                                setRemovals((prev) =>
                                  prev.filter((_, i) => i !== idx)
                                );
                                setComponents((prev) => [
                                  ...prev,
                                  {
                                    id: r.component_id,
                                    barcode: r.barcode,
                                    unit: r.unit,
                                    consume_qty: r.original_consume,
                                    master: { id: 0, name: r.master_name },
                                    link_id: r.link_id,
                                  },
                                ]);
                              }}
                            >
                              Geri Al
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => {
                    handleRemovalPersist().catch(() => {});
                  }}
                  disabled={
                    totalOveruseError ||
                    !removals.length ||
                    !removals.every(
                      (r) =>
                        r.warehouse_id &&
                        r.location_id &&
                        (r.unit === "EA" ||
                          (typeof r.return_qty === "number" &&
                            r.return_qty > 0 &&
                            r.return_qty <= r.original_consume))
                    )
                  }
                >
                  Kaydet (İade)
                </Button>
              </div>
            </ComponentCard>
          )}

          {/* PRODUCT: Hurdaya ayrılacaklar */}
          {scraps.length > 0 && (
            <ComponentCard title="Hurdaya Ayrılacaklar (FIRE)">
              {totalOveruseError && (
                <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
                  Uyarı: Aynı komponent için iade + hurda toplamı kullanılan miktardan fazla olamaz.
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-gray-700 dark:text-gray-200">
                  <thead>
                    <tr className="text-left text-gray-500 dark:text-gray-400">
                      <th className="px-3 py-2">Barkod</th>
                      <th className="px-3 py-2">Tanım</th>
                      <th className="px-3 py-2">FIRE Miktarı</th>
                      <th className="px-3 py-2">Birim</th>
                      <th className="px-3 py-2">Neden (ops.)</th>
                      <th className="px-3 py-2">Aksiyon</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scraps.map((s, idx) => (
                      <tr
                        key={`scrap-${idx}`}
                        className="border-t border-gray-100 dark:border-gray-800"
                      >
                        <td className="px-3 py-2">{s.barcode}</td>
                        <td className="px-3 py-2">{s.master_name ?? "-"}</td>
                        <td className="px-3 py-2">
                          <Input
                            type="number"
                            min="0"
                            max={String(s.original_consume)}
                            disabled={s.unit === "EA"}
                            value={
                              s.unit === "EA" ? s.original_consume : s.fire_qty ?? ""
                            }
                            onChange={(e) =>
                              setScraps((prev) =>
                                prev.map((x, i) =>
                                  i === idx
                                    ? {
                                        ...x,
                                        fire_qty: Number(e.target.value || 0),
                                      }
                                    : x
                                )
                              )
                            }
                            placeholder={
                              s.unit === "EA" ? "" : `0 - ${s.original_consume}`
                            }
                          />
                        </td>
                        <td className="px-3 py-2">{s.unit}</td>
                        <td className="px-3 py-2">
                          <Input
                            value={s.reason || ""}
                            onChange={(e) =>
                              setScraps((prev) =>
                                prev.map((x, i) =>
                                  i === idx ? { ...x, reason: e.target.value } : x
                                )
                              )
                            }
                            placeholder="Opsiyonel"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setScraps((prev) =>
                                prev.filter((_, i) => i !== idx)
                              );
                              setComponents((prev) => [
                                ...prev,
                                {
                                  id: s.component_id,
                                  barcode: s.barcode,
                                  unit: s.unit,
                                  consume_qty: s.original_consume,
                                  master: { id: 0, name: s.master_name },
                                  link_id: s.link_id,
                                },
                              ]);
                            }}
                          >
                            Geri Al
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end">
                <Button
                  variant="primary"
                  onClick={() => {
                    handleScrapPersist().catch(() => {});
                  }}
                  disabled={
                    totalOveruseError ||
                    !scraps.length ||
                    !scraps.every(
                      (s) =>
                        s.unit === "EA" ||
                        (typeof s.fire_qty === "number" &&
                          s.fire_qty > 0 &&
                          s.fire_qty <= s.original_consume)
                    )
                  }
                >
                  Kaydet (FIRE)
                </Button>
              </div>
            </ComponentCard>
          )}

          {/* ---------- TIMELINE ---------- */}
          <ComponentCard title="Geçmiş">
            {tlError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {tlError}
              </div>
            )}

            {!tlItems.length && !tlLoading ? (
              <div className="py-4 text-sm text-gray-500 dark:text-gray-400">
                Kayıt bulunamadı.
              </div>
            ) : (
              <ul className="space-y-3">
                {tlItems.map((t) => (
                  <li
                    key={t.id}
                    className="rounded-xl border border-gray-200 p-3 text-sm shadow-theme-xs dark:border-gray-800"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-gray-800 dark:text-gray-100">
                        {humanize(t.action)}
                      </div>
                      <div className="shrink-0 text-xs text-gray-500">
                        {fmt(t.created_at)}
                      </div>
                    </div>

                    <div className="mt-1 text-gray-700 dark:text-gray-300">
                      {lineFor(t)}
                    </div>

                    {(t.notes ||
                      (t.meta && Object.keys(t.meta || {}).length)) && (
                      <div className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg.white/5 dark:text-gray-300">
                        {t.notes ? <div>Not: {t.notes}</div> : null}
                        {t.meta && Object.keys(t.meta || {}).length ? (
                          <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words">
                            {JSON.stringify(t.meta, null, 2)}
                          </pre>
                        ) : null}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">Toplam {tlTotal} kayıt</div>
              <div className="flex items-center gap-2">
                {tlLoading && (
                  <span className="text-sm text-gray-500">Yükleniyor…</span>
                )}
                {tlHasMore && !tlLoading && (
                  <Button
                    variant="outline"
                    onClick={() => fetchTransitions(false)}
                  >
                    Daha Fazla Yükle
                  </Button>
                )}
              </div>
            </div>
          </ComponentCard>
        </>
      )}
    </div>
  );
}
