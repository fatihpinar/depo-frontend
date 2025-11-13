// src/pages/Approvals/StockReceiptApprovalPage.tsx
import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";

/* UI */
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import { Link } from "react-router-dom";

/* Scanner */
import BarcodeScannerModal from "../../components/scan/BarcodeScannerModal";

type Warehouse = { id: number; name: string };
type Location  = { id: number; name: string; warehouse_id: number };

type PendingRow = {
  id: number;
  kind: "component" | "product";
  barcode: string;
  unit?: "EA" | "M" | "KG" | string | null;
  quantity?: number | null;
  width?: number | null;
  height?: number | null;
  master?: { id: number; display_label?: string | null } | null;
  warehouse_id?: number | null;
  location_id?: number | null;
};

const UNIT_WORD: Record<string,string> = { EA: "Ad.", M: "Metre", KG: "Gram" };
const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });

const normalize = (v: string | null | undefined) => String(v ?? "").trim().toUpperCase();

export default function StockReceiptApprovalPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string|null>(null);

  /* selection */
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const keyOf = (r: PendingRow) => `${r.kind}:${r.id}`;
  const isSelected = (r: PendingRow) => selectedIds.has(keyOf(r));
  const toggleOne = (r: PendingRow) =>
    setSelectedIds(prev => { const n=new Set(prev); const k=keyOf(r); n.has(k)?n.delete(k):n.add(k); return n; });
  const allSelected = rows.length>0 && rows.every(isSelected);
  const toggleAll   = (checked:boolean)=> setSelectedIds(checked? new Set(rows.map(keyOf)) : new Set());

  /* globals */
  const [globalWarehouse, setGlobalWarehouse] = useState("");
  const [globalLocation,  setGlobalLocation]  = useState("");

  const warehouseOptions = useMemo(
    () => [{ value:"", label:"Seçiniz", disabled:true }, ...warehouses.map(w => ({ value:String(w.id), label:w.name }))],
    [warehouses]
  );
  const globalLocationOptions = useMemo(() => {
    const list = globalWarehouse ? (locationsByWarehouse[Number(globalWarehouse)] || []) : [];
    return [{ value:"", label:"Seçiniz", disabled:true }, ...list.map(l => ({ value:String(l.id), label:l.name }))];
  }, [globalWarehouse, locationsByWarehouse]);

  /* helpers */
  const ensureLocations = async (warehouseId: string|number) => {
    const id = Number(warehouseId); if(!id) return [];
    if (locationsByWarehouse[id]) return locationsByWarehouse[id];
    const { data } = await api.get("/lookups/locations", { params:{ warehouseId:id }});
    const list: Location[] = data || [];
    setLocationsByWarehouse(prev => ({ ...prev, [id]: list }));
    return list;
  };

  /* Scanner state */
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTargetKey, setScanTargetKey] = useState<string | null>(null);
  const openScannerFor = (r: PendingRow) => {
    setScanTargetKey(keyOf(r));
    setScanOpen(true);
  };
  const closeScanner = () => setScanOpen(false);
  const handleScanResult = (text: string) => {
    if (!scanTargetKey) return;
    setRows(prev =>
      prev.map(x => keyOf(x) === scanTargetKey ? ({ ...x, barcode: text }) : x)
    );
  };

  /* load */
  useEffect(() => {
    (async () => {
      try {
        const [wh, pending] = await Promise.all([
          api.get("/lookups/warehouses"),
          api.get("/approvals/pending", { params:{ scope:"stock" } }),
        ]);
        setWarehouses(wh.data || []);

        const toNum = (v: any): number | null =>
          (v === "" || v === null || v === undefined) ? null : Number(v);

        const raw: any[] = pending.data || [];
        const items: PendingRow[] = raw.map((r) => ({
          id: r.id,
          kind: r.kind,
          barcode: r.barcode || "",
          unit: r.unit ?? null,
          quantity: toNum(r.quantity),
          width: toNum(r.width),
          height: toNum(r.height),
          master: r.master ?? null,
          warehouse_id: toNum(r.warehouse_id),
          location_id: toNum(r.location_id),
        }));
        setRows(items);

        const uniqWh = Array.from(new Set(items.map(r => r.warehouse_id).filter(Boolean))) as number[];
        await Promise.all(uniqWh.map(id => ensureLocations(id)));
      } catch (e:any) {
        console.error(e);
        setError("Kayıtlar yüklenemedi.");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTo = (scope:"selected"|"all") => {
    if(!globalWarehouse || !globalLocation) return;
    const targets = scope==="selected" ? rows.filter(isSelected) : rows;
    setRows(prev => prev.map(r => targets.find(t => t.id===r.id && t.kind===r.kind)
      ? { ...r, warehouse_id:Number(globalWarehouse), location_id:Number(globalLocation) }
      : r
    ));
  };

  const handleApproveSelected = async () => {
    try {
      const selectedRows = rows.filter(isSelected);
      if (!selectedRows.length) return alert("Önce satır seçiniz.");

      const missingDepot = selectedRows.filter(r => !r.warehouse_id || !r.location_id);
      if (missingDepot.length) {
        const ex = (missingDepot[0].master?.display_label) ?? (missingDepot[0].barcode) ?? "(tanım yok)";
        return alert(`Bazı seçili satırlarda depo/lokasyon eksik. Örn: ${ex}`);
      }

      const badBarcode = selectedRows.find(r => {
        const code = normalize(r.barcode);
        if (!code) return true;
        const re = r.kind === "component" ? /^C\d{8}$/ : /^P\d{8}$/;
        return !re.test(code);
      });
      if (badBarcode) {
        const name = badBarcode.master?.display_label ?? "(tanım yok)";
        return alert(`Barkod eksik ya da format hatalı. Örn satır: ${name} #${badBarcode.id}`);
      }

      setLoading(true);
      await api.post("/approvals/approve", {
        scope: "stock",
        items: selectedRows.map(r => ({
          id: r.id,
          kind: r.kind,
          warehouse_id: r.warehouse_id,
          location_id: r.location_id,
          barcode: normalize(r.barcode),
        })),
      });

      const ok = new Set(selectedRows.map(keyOf));
      setRows(prev => prev.filter(r => !ok.has(keyOf(r))));
      setSelectedIds(new Set());
      setGlobalWarehouse(""); setGlobalLocation("");
      alert("Seçili kayıtlar onaylandı ve depoya alındı.");
    } catch (e:any) {
      console.error(e?.response?.data || e);
      alert(e?.response?.data?.message || "Onaylama sırasında hata.");
    } finally { setLoading(false); }
  };

  /* fmt */
  const unitOf = (r:PendingRow) => (r.unit || "EA").toUpperCase();
  const fmtQty  = (r:PendingRow) => {
    const u = unitOf(r);
    const q = u === "EA" ? 1 : Number(r.quantity ?? 0);
    if (!(q > 0)) return "—";
    return `${nf.format(q)} ${UNIT_WORD[u] || u}`;
  };
  const fmtDim  = (r:PendingRow) => {
    const w = r.width, h = r.height;
    const hasW = typeof w === "number" && !Number.isNaN(w) && w > 0;
    const hasH = typeof h === "number" && !Number.isNaN(h) && h > 0;
    if (!hasW && !hasH) return "—";
    return `${hasW ? nf.format(w!) : "—"} × ${hasH ? nf.format(h!) : "—"} metre`;
  };

  const GRID_COLS = "grid-cols-[44px_minmax(380px,2fr)_minmax(260px,1.2fr)_96px_120px_180px_200px]";

  return (
    <div className="space-y-6">
      <PageMeta title="Stok Girişi Tamamlama" description="Pending kayıtları depoya alma" />
      <PageBreadcrumb pageTitle="Stok Girişi Tamamlama" />

      <ComponentCard title="Varsayılan Depo & Lokasyon">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Varsayılan Depo</Label>
            <Select
              options={warehouseOptions}
              value={globalWarehouse}
              onChange={async (v: string) => {
                setGlobalWarehouse(v);
                const locs = await ensureLocations(v);
                setGlobalLocation(locs[0]?.id ? String(locs[0].id) : "");
              }}
              placeholder="Seçiniz"
            />
          </div>
          <div>
            <Label>Varsayılan Lokasyon</Label>
            <Select
              options={globalLocationOptions}
              value={globalLocation}
              onChange={setGlobalLocation}
              placeholder="Seçiniz"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => applyTo("selected")}
            disabled={!globalWarehouse || !globalLocation || selectedIds.size === 0}
          >
            Seçilenlere Uygula
          </Button>
          <Button
            variant="outline"
            onClick={() => applyTo("all")}
            disabled={!globalWarehouse || !globalLocation || rows.length === 0}
          >
            Tümüne Uygula
          </Button>
        </div>
      </ComponentCard>

      <ComponentCard title={`Satırlar (${rows.length})`}>
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </div>
        )}

        <div className="mb-4 flex items-center gap-3">
          <Checkbox checked={allSelected} onChange={toggleAll} />
          <span className="text-sm text-gray-700 dark:text-gray-300">Tümünü Seç</span>
          <span className="ml-auto text-xs text-gray-500">Seçili: {selectedIds.size}</span>
        </div>

        {/* DESKTOP: Table Layout */}
        <div className="hidden md:block overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className={`grid py-2 text-xs font-medium text-gray-500 dark:text-gray-400 ${GRID_COLS}`}>
              <div className="px-3 text-left" />
              <div className="px-3 text-left">Tanım</div>
              <div className="px-3 text-left">Barkod</div>
              <div className="px-3 text-left">Miktar</div>
              <div className="px-3 text-left">En × Boy</div>
              <div className="px-3 text-left">Depo</div>
              <div className="px-3 text-left">Lokasyon</div>
            </div>

            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length === 0 ? (
                <div className="px-4 py-6 text-sm text-gray-500">Onay bekleyen kayıt yok.</div>
              ) : (
                rows.map((r) => {
                  const wh = r.warehouse_id ? String(r.warehouse_id) : "";
                  const locOpts = [
                    { value: "", label: "Seçiniz", disabled: true },
                    ...(((wh ? locationsByWarehouse[Number(wh)] : []) || []).map((l) => ({
                      value: String(l.id),
                      label: l.name,
                    })) as any),
                  ];
                  const okBarcode = !!normalize(r.barcode);

                  return (
                    <div key={`${r.kind}-${r.id}`} className={`grid items-center gap-0 py-2 ${GRID_COLS}`}>
                      <div className="px-3">
                        <Checkbox checked={isSelected(r)} onChange={() => toggleOne(r)} />
                      </div>

                      <div className="px-3">
                        <Link
                          to={`/details/${r.kind}/${r.id}`}
                          className="block max-w-full text-left text-sm text-brand-600 hover:underline underline-offset-2 dark:text-brand-400"
                          title={`${r.kind === 'component' ? 'Komponent' : 'Ürün'} detayını aç`}
                        >
                          <span className="block overflow-hidden break-words whitespace-normal leading-snug line-clamp-2">
                            {r.master?.display_label || "(Tanım Yok)"} #{r.id}
                          </span>
                        </Link>
                      </div>

                      <div className="px-3">
                        <div className="relative">
                          <Input
                            type="text"
                            value={r.barcode || ""}
                            onChange={(e) =>
                              setRows(prev =>
                                prev.map(x =>
                                  x.id === r.id && x.kind === r.kind
                                    ? ({ ...x, barcode: e.target.value })
                                    : x
                                )
                              )
                            }
                            placeholder="Barkod"
                            className={`pr-10 ${okBarcode || !r.barcode ? "" : "border-error-500 focus:ring-error-500"}`}
                          />
                          <button
                            type="button"
                            onClick={() => openScannerFor(r)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                            title="Barkod/QR Oku"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                              <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                              <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                              <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                              <rect x="8" y="8" width="8" height="8" rx="1" />
                            </svg>
                          </button>
                        </div>
                        {!okBarcode && r.barcode && (
                          <div className="mt-1 text-xs text-amber-600">Barkod formatını kontrol ediniz.</div>
                        )}
                      </div>

                      <div className="px-3">
                        <span className="text-sm text-gray-800 dark:text-gray-100">{fmtQty(r)}</span>
                      </div>

                      <div className="px-3">
                        <span className="text-sm text-gray-800 dark:text-gray-100">{fmtDim(r)}</span>
                      </div>

                      <div className="px-3">
                        <Select
                          className="w-full"
                          options={warehouseOptions}
                          value={wh}
                          onChange={async (v: string) => {
                            const locs = await ensureLocations(v);
                            const nextLoc = String(locs[0]?.id || "");
                            setRows((prev) =>
                              prev.map((x) =>
                                x.id === r.id && x.kind === r.kind
                                  ? { ...x, warehouse_id: v ? Number(v) : undefined, location_id: v ? Number(nextLoc) : undefined }
                                  : x
                              )
                            );
                          }}
                          placeholder="Seçiniz"
                        />
                      </div>

                      <div className="px-3">
                        <Select
                          className="w-full"
                          options={locOpts}
                          value={r.location_id ? String(r.location_id) : ""}
                          onChange={(v: string) =>
                            setRows((prev) =>
                              prev.map((x) =>
                                x.id === r.id && x.kind === r.kind ? { ...x, location_id: v ? Number(v) : undefined } : x
                              )
                            )
                          }
                          placeholder="Seçiniz"
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* MOBILE: Card Layout */}
        <div className="md:hidden space-y-3">
          {rows.length === 0 ? (
            <div className="px-4 py-6 text-sm text-gray-500">Onay bekleyen kayıt yok.</div>
          ) : (
            rows.map((r) => {
              const wh = r.warehouse_id ? String(r.warehouse_id) : "";
              const locOpts = [
                { value: "", label: "Seçiniz", disabled: true },
                ...(((wh ? locationsByWarehouse[Number(wh)] : []) || []).map((l) => ({
                  value: String(l.id),
                  label: l.name,
                })) as any),
              ];
              const okBarcode = !!normalize(r.barcode);

              return (
                <div key={`${r.kind}-${r.id}`} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
                  {/* Header */}
                  <div className="mb-3 flex items-start gap-3">
                    <div className="pt-1">
                      <Checkbox checked={isSelected(r)} onChange={() => toggleOne(r)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link
                        to={`/details/${r.kind}/${r.id}`}
                        className="block text-sm font-semibold text-brand-600 hover:underline underline-offset-2 dark:text-brand-400"
                        title={`${r.kind === 'component' ? 'Komponent' : 'Ürün'} detayını aç`}
                      >
                        {r.master?.display_label || "(Tanım Yok)"} #{r.id}
                      </Link>
                      <div className="mt-1 text-xs text-gray-500">
                        {fmtQty(r)} • {fmtDim(r)}
                      </div>
                    </div>
                  </div>

                  {/* Fields */}
                  <div className="space-y-3">
                    <div>
                      <Label>Barkod</Label>
                      <div className="relative">
                        <Input
                          type="text"
                          value={r.barcode || ""}
                          onChange={(e) =>
                            setRows(prev =>
                              prev.map(x =>
                                x.id === r.id && x.kind === r.kind
                                  ? ({ ...x, barcode: e.target.value })
                                  : x
                              )
                            )
                          }
                          placeholder="Barkod"
                          className={`pr-10 ${okBarcode || !r.barcode ? "" : "border-error-500 focus:ring-error-500"}`}
                        />
                        <button
                          type="button"
                          onClick={() => openScannerFor(r)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/10 dark:hover:text-white"
                          title="Barkod/QR Oku"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 7V5a2 2 0 0 1 2-2h2" />
                            <path d="M17 3h2a2 2 0 0 1 2 2v2" />
                            <path d="M21 17v2a2 2 0 0 1-2 2h-2" />
                            <path d="M7 21H5a2 2 0 0 1-2-2v-2" />
                            <rect x="8" y="8" width="8" height="8" rx="1" />
                          </svg>
                        </button>
                      </div>
                      {!okBarcode && r.barcode && (
                        <div className="mt-1 text-xs text-amber-600">Barkod formatını kontrol ediniz.</div>
                      )}
                    </div>

                    <div>
                      <Label>Depo</Label>
                      <Select
                        options={warehouseOptions}
                        value={wh}
                        onChange={async (v: string) => {
                          const locs = await ensureLocations(v);
                          const nextLoc = String(locs[0]?.id || "");
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id && x.kind === r.kind
                                ? { ...x, warehouse_id: v ? Number(v) : undefined, location_id: v ? Number(nextLoc) : undefined }
                                : x
                            )
                          );
                        }}
                        placeholder="Seçiniz"
                      />
                    </div>

                    <div>
                      <Label>Lokasyon</Label>
                      <Select
                        options={locOpts}
                        value={r.location_id ? String(r.location_id) : ""}
                        onChange={(v: string) =>
                          setRows((prev) =>
                            prev.map((x) =>
                              x.id === r.id && x.kind === r.kind ? { ...x, location_id: v ? Number(v) : undefined } : x
                            )
                          )
                        }
                        placeholder="Seçiniz"
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={handleApproveSelected} disabled={loading || selectedIds.size === 0}>
            Seçilenleri Onayla
          </Button>
        </div>
      </ComponentCard>

      <BarcodeScannerModal
        open={scanOpen}
        onClose={closeScanner}
        onResult={handleScanResult}
      />
    </div>
  );
}