// src/pages/Details/ComponentDetailPage.tsx
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

// YENİ: merkezi transition formatlayıcı
import {
  formatTransitionTR,
  type TransitionRow as TLRow,
} from "../../utils/transitionFormat";

/* ---------- Lookups ---------- */
type Warehouse = { id: number; name: string };
type Location = { id: number; name: string; warehouse_id: number };
type MasterMini = {
  id: number;
  name?: string | null;
  display_label?: string | null;
  bimeks_product_name?: string | null; // 👈 yeni
  bimeks_code?: string | null;
  length_unit?: string | null;
};


/* ---------- Status ---------- */
type StatusOpt = { value: number; label: string };

export default function ComponentDetailPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const id = Number(rawId || 0);

  const [loading, setLoading] = useState(true);

  /* ------ lookups ------ */
  const [statuses, setStatuses] = useState<StatusOpt[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});
  const [masters, setMasters] = useState<MasterMini[]>([]);

  /* ------ component state ------ */
  const [barcode, setBarcode] = useState("");
  const [masterId, setMasterId] = useState<number | "">("");
  const [statusId, setStatusId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [locationId, setLocationId] = useState<number | "">("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [notes, setNotes] = useState("");

  const [width, setWidth] = useState<number | "">("");
  const [height, setHeight] = useState<number | "">("");
  const [area, setArea] = useState<number | "">(""); // 👈 yeni
  // en / boy değişince alanı canlı hesapla
  useEffect(() => {
    if (width === "" || height === "") {
      setArea("");
      return;
    }

    const w = Number(width);
    const h = Number(height);

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      setArea("");
      return;
    }

    setArea(w * h);
  }, [width, height]);

    const [masterCode, setMasterCode] = useState<string>(""); // 👈 YENİ
    const [masterUnitLabel, setMasterUnitLabel] = useState<string>(""); // 👈 yeni


  /* ------ seçenekler ------ */
  const warehouseOptions = useMemo(
    () => [{ value: "", label: "Seçiniz", disabled: true }, ...warehouses.map((w) => ({ value: String(w.id), label: w.name }))],
    [warehouses]
  );
  const locationOptions = useMemo(() => {
    const list = warehouseId ? locationsByWarehouse[Number(warehouseId)] || [] : [];
    return [{ value: "", label: "Seçiniz", disabled: true }, ...list.map((l) => ({ value: String(l.id), label: l.name }))];
  }, [warehouseId, locationsByWarehouse]);
  
  /* ------ helpers ------ */
  const ensureLocations = async (wh: number | "") => {
    const w = Number(wh || 0);
    if (!w || locationsByWarehouse[w]) return;
    try {
      const { data } = await api.get(`/lookups/locations`, { params: { warehouseId: w } });
      setLocationsByWarehouse((prev) => ({ ...prev, [w]: data || [] }));
    } catch (e) {
      console.error("locations load error", e);
    }
  };

  /* ------ lookups yükle ------ */
  useEffect(() => {
    (async () => {
      try {
        const [whRes, mastersRes] = await Promise.all([api.get("/lookups/warehouses"), api.get("/masters")]);
        setWarehouses(whRes.data || []);
        setMasters(mastersRes.data || []);

        // Statüler
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

  /* ------ component kaydını yükle ------ */
  useEffect(() => {
    if (!id) { navigate("/404"); return; }
    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/components/${id}`);
        setBarcode(data.barcode || "");
        setMasterId(data.master?.id || "");
        setStatusId(data.status_id || "");
        setWarehouseId(data.warehouse?.id || "");
        if (data.warehouse?.id) await ensureLocations(data.warehouse.id);
        setLocationId(data.location?.id || "");
        setInvoiceNo(data.invoice_no || "");
        setNotes(data.notes || "");

        // width / height sayıya çevrilmiş hali
        const wNum = data.width !== null && data.width !== undefined
          ? Number(data.width)
          : null;
        const hNum = data.height !== null && data.height !== undefined
          ? Number(data.height)
          : null;

        setWidth(wNum !== null && !Number.isNaN(wNum) ? wNum : "");
        setHeight(hNum !== null && !Number.isNaN(hNum) ? hNum : "");

        // area (DB'de varsa onu, yoksa w*h)
        const areaNum =
          data.area !== null && data.area !== undefined
            ? Number(data.area)
            : wNum !== null && hNum !== null
              ? wNum * hNum
              : null;

        setArea(
          areaNum !== null && !Number.isNaN(areaNum) ? areaNum : ""
        );

        setMasterCode(data.master?.bimeks_code || "");

        const lu = data.master?.length_unit || null;
        setMasterUnitLabel(
          lu === "m" ? "Metre" :
            lu === "um" ? "Mikron" :
              lu || ""
        );

      } catch (err) {
        console.error("component details load error:", err);
        alert("Detay yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  /* ------ Kaydet (component) ------ */
  const handleSave = async () => {
    try {
    // 🔴 En / boy zorunlu
    if (width === "" || height === "") {
      alert("En ve boy alanları zorunludur.");
      return;
    }

    const w = Number(width);
    const h = Number(height);

    if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
      alert("En ve boy 0'dan büyük sayılar olmalıdır.");
      return;
    }

    if (Number(statusId) === 1) {
      if (!warehouseId || !locationId) {
        alert("Durum 'Depoda' iken Depo ve Lokasyon seçimi zorunludur.");
        return;
      }
    }

    const payload: any = {
      barcode,
      master_id: masterId ? Number(masterId) : undefined,
      status_id: statusId ? Number(statusId) : undefined,
      warehouse_id: warehouseId
        ? Number(warehouseId)
        : Number(statusId) === 1
        ? Number(warehouseId)
        : null,
      location_id: locationId
        ? Number(locationId)
        : Number(statusId) === 1
        ? Number(locationId)
        : null,
      invoice_no: invoiceNo.trim() ? invoiceNo.trim() : null,
      notes: notes || null,
      width: w,
      height: h,
      area: w * h, // 🔴 alanı da gönder
    };



      await api.put(`/components/${id}`, payload);
      alert("Komponent güncellendi.");
    } catch (err: any) {
      console.error("save error:", err?.response?.data || err);
      alert("Kaydetme hatası.");
    }
  };

  /* ------ timeline (component) ------ */
  const [tlLoading, setTlLoading] = useState(false);
  const [tlError, setTlError] = useState<string | null>(null);
  const [tlItems, setTlItems] = useState<TLRow[]>([]);
  const [tlTotal, setTlTotal] = useState<number>(0);
  const [tlOffset, setTlOffset] = useState<number>(0);
  const TL_PAGE = 20;

  const fetchTransitions = async (reset = false) => {
    try {
      setTlLoading(true);
      setTlError(null);
      const params = { item_type: "component", item_id: id, limit: TL_PAGE, offset: reset ? 0 : tlOffset };
      const { data } = await api.get(`/inventory-transitions`, { params });
      const rows: TLRow[] = data?.rows || data || [];
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
    fetchTransitions(true).catch(() => { });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // tarih biçimleyici
  const fmt = (d?: string) => (d ? new Date(d).toLocaleString() : "");
  const tlHasMore = tlItems.length < tlTotal;

  const currentMaster = masters.find((m) => m.id === masterId);
  const masterDisplay =
    currentMaster
      ? currentMaster.display_label ||
      currentMaster.bimeks_product_name ||
      currentMaster.name ||
      ""
      : "";

  return (
    <div className="space-y-6">
      <PageMeta title="Komponent Detay" description="Komponent detay sayfası" />
      <PageBreadcrumb pageTitle="Komponent Detay" />

      {loading ? (
        <ComponentCard title="Yükleniyor…">
          <div className="py-6 text-sm text-gray-500">Lütfen bekleyin…</div>
        </ComponentCard>
      ) : (
        <>
          <ComponentCard title="Komponent">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Tanım (Master)</Label>
                <Input value={masterDisplay} disabled />
              </div>

              <div>
                <Label>Bimeks Kodu (Master)</Label>
                <Input
                  value={masterCode}
                  disabled
                  placeholder="Seçilen master'ın Bimeks kodu"
                />
              </div>

              <div>
                <Label>Barkod</Label>
                <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
              </div>

              <div>
                <Label>Durum</Label>
                <Select
                  options={[{ value: "", label: "Seçiniz", disabled: true }, ...statuses.map((s) => ({ value: String(s.value), label: s.label }))]}
                  value={statusId ? String(statusId) : ""}
                  onChange={(v: string) => setStatusId(v ? Number(v) : "")}
                />
              </div>

              <div>
                <Label>En <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={width === "" ? "" : String(width)}
                  onChange={(e) =>
                    setWidth(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Zorunlu"
                />
              </div>

              <div>
                <Label>Boy <span className="text-red-500">*</span></Label>
                <Input
                  type="number"
                  value={height === "" ? "" : String(height)}
                  onChange={(e) =>
                    setHeight(e.target.value === "" ? "" : Number(e.target.value))
                  }
                  placeholder="Zorunlu"
                />
              </div>

              <div>
                <Label>Ölçü Birimi</Label>
                <Input value={masterUnitLabel} disabled />
              </div>

              <div>
                <Label>Alan (m²)</Label>
                <Input
                  type="number"
                  value={area === "" ? "" : String(area)}
                  disabled
                />
              </div>

              <div>
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

              <div>
                <Label>Lokasyon</Label>
                <Select
                  options={locationOptions}
                  value={locationId ? String(locationId) : ""}
                  onChange={(v: string) => setLocationId(v ? Number(v) : "")}
                  placeholder="Seçiniz"
                />
              </div>

              <div>
                <Label>Fatura No</Label>
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="Opsiyonel"
                />
              </div>

              <div className="md:col-span-2">
                <Label>Notlar</Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opsiyonel" />
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <Button variant="primary" onClick={handleSave}>
                Kaydet
              </Button>
            </div>
          </ComponentCard>

          {/* ---------- TIMELINE ---------- */}
          <ComponentCard title="Geçmiş">
            {tlError && (
              <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
                {tlError}
              </div>
            )}

            {!tlItems.length && !tlLoading ? (
              <div className="py-4 text-sm text-gray-500 dark:text-gray-400">Kayıt bulunamadı.</div>
            ) : (
              <ul className="space-y-3">
                {tlItems.map((t) => {
                  const f = formatTransitionTR(t);
                  return (
                    <li
                      key={t.id}
                      className="rounded-xl border border-gray-200 p-3 text-sm shadow-theme-xs dark:border-gray-800"
                    >
                      {/* başlık + tarih */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="font-medium text-gray-800 dark:text-gray-100">
                          {f.title}
                        </div>
                        <div className="shrink-0 text-xs text-gray-500">
                          {fmt(t.created_at)}
                        </div>
                      </div>

                      {/* yer satırı */}
                      {f.placeLine && (
                        <div className="mt-1 text-gray-700 dark:text-gray-300">
                          {f.placeLine}
                        </div>
                      )}

                      {/* rozetler: miktar / yeni barkod vs. */}
                      {f.extras.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {f.extras.map((x, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-700 dark:border-gray-800 dark:text-gray-300"
                            >
                              {x}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* not ve meta (varsa) */}
                      {(!!t.notes || (!!t.meta && Object.keys(t.meta || {}).length > 0)) && (
                        <div className="mt-2 rounded-lg bg-gray-50 p-2 text-xs text-gray-600 dark:bg-white/5 dark:text-gray-300">
                          {t.notes ? <div>Not: {t.notes}</div> : null}
                          {!!t.meta && Object.keys(t.meta || {}).length > 0 ? (
                            <pre className="mt-1 overflow-auto whitespace-pre-wrap break-words">
                              {JSON.stringify(t.meta, null, 2)}
                            </pre>
                          ) : null}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-gray-500">Toplam {tlTotal} kayıt</div>
              <div className="flex items-center gap-2">
                {tlLoading && <span className="text-sm text-gray-500">Yükleniyor…</span>}
                {tlHasMore && !tlLoading && (
                  <Button variant="outline" onClick={() => fetchTransitions(false)}>
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
