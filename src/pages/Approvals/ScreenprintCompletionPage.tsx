import { useEffect, useMemo, useState } from "react";
import api from "../../services/api";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import Checkbox from "../../components/form/input/Checkbox";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

type Warehouse = { id: number; name: string };
type Location  = { id: number; name: string; warehouse_id: number };
type PendingRow = {
  id: number; kind: "component" | "product"; barcode: string;
  unit?: "EA" | "M" | "KG" | string | null;
  quantity?: number | null; width?: number | null; height?: number | null;
  master?: { id: number; display_label?: string | null } | null;
  warehouse_id?: number | null; location_id?: number | null;
};

const UNIT_WORD: Record<string,string> = { EA: "Ad.", M: "Metre", KG: "Gram" };
const nf = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 3 });
const SCOPE = "screenprint" as const;

export default function ScreenprintCompletionPage() {
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<Record<number, Location[]>>({});
  const [rows, setRows] = useState<PendingRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string|null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const keyOf = (r: PendingRow) => `${r.kind}:${r.id}`;
  const isSelected = (r: PendingRow) => selectedIds.has(keyOf(r));
  const toggleOne = (r: PendingRow) =>
    setSelectedIds(prev => { const n=new Set(prev); const k=keyOf(r); n.has(k)?n.delete(k):n.add(k); return n; });
  const allSelected = rows.length>0 && rows.every(isSelected);
  const toggleAll   = (checked:boolean)=> setSelectedIds(checked? new Set(rows.map(keyOf)) : new Set());

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

  const ensureLocations = async (warehouseId: string|number) => {
    const id = Number(warehouseId); if(!id) return [];
    if (locationsByWarehouse[id]) return locationsByWarehouse[id];
    const { data } = await api.get("/lookups/locations", { params:{ warehouseId:id }});
    const list: Location[] = data || [];
    setLocationsByWarehouse(prev => ({ ...prev, [id]: list }));
    return list;
  };

  useEffect(() => {
    (async () => {
      try {
        const [wh, pending] = await Promise.all([
          api.get("/lookups/warehouses"),
          api.get("/approvals/pending", { params:{ scope:SCOPE } }),
        ]);
        setWarehouses(wh.data || []);
        const toNum = (v:any)=> (v===""||v==null? null : Number(v));
        const raw:any[] = pending.data || [];
        const items:PendingRow[] = raw.map(r=>({
          id:r.id, kind:r.kind, barcode:r.barcode,
          unit:r.unit ?? null, quantity:toNum(r.quantity),
          width:toNum(r.width), height:toNum(r.height),
          master:r.master ?? null, warehouse_id:toNum(r.warehouse_id), location_id:toNum(r.location_id),
        }));
        setRows(items);
        const uniqWh = Array.from(new Set(items.map(r=>r.warehouse_id).filter(Boolean))) as number[];
        await Promise.all(uniqWh.map(id=>ensureLocations(id)));
      } catch(e:any){ console.error(e); setError("Kayıtlar yüklenemedi."); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyTo = (scope:"selected"|"all") => {
    if(!globalWarehouse || !globalLocation) return;
    const targets = scope==="selected"? rows.filter(isSelected) : rows;
    setRows(prev => prev.map(r => targets.find(t=>t.id===r.id && t.kind===r.kind)
      ? { ...r, warehouse_id:Number(globalWarehouse), location_id:Number(globalLocation) } : r));
  };

  const handleApproveSelected = async () => {
    try {
      const selectedRows = rows.filter(isSelected);
      if (!selectedRows.length) return alert("Önce satır seçiniz.");
      const missing = selectedRows.filter(r => !r.warehouse_id || !r.location_id);
      if (missing.length) return alert(`Bazı seçili satırlarda depo/lokasyon eksik. Örn: ${missing[0].master?.display_label ?? missing[0].barcode}`);

      setLoading(true);
      await api.post("/approvals/approve", {
        scope: SCOPE,
        items: selectedRows.map(r => ({ id:r.id, kind:r.kind, warehouse_id:r.warehouse_id, location_id:r.location_id })),
      });
      const ok = new Set(selectedRows.map(keyOf));
      setRows(prev => prev.filter(r => !ok.has(keyOf(r))));
      setSelectedIds(new Set()); setGlobalWarehouse(""); setGlobalLocation("");
      alert("Seçili üretim kayıtları tamamlandı.");
    } catch(e:any){ console.error(e?.response?.data || e); alert(e?.response?.data?.message || "Tamamlama sırasında hata."); }
    finally{ setLoading(false); }
  };

  const unitOf = (r:PendingRow) => (r.unit || "EA").toUpperCase();
  const fmtQty  = (r:PendingRow) => { const u=unitOf(r); const q=u==="EA"?1:Number(r.quantity??0); return q>0? `${nf.format(q)} ${UNIT_WORD[u]||u}` : "—"; };
  const fmtDim  = (r:PendingRow) => { const w=r.width,h=r.height; const hasW=typeof w==="number"&&w>0; const hasH=typeof h==="number"&&h>0; return (!hasW&&!hasH)?"—":`${hasW?nf.format(w!):"—"} × ${hasH?nf.format(h!):"—"} metre`; };
  const labelOf = (r:PendingRow) => `${r.master?.display_label || "(Tanım Yok)"} #${r.id}`;
  const GRID_COLS = "grid-cols-[44px_minmax(380px,2fr)_minmax(180px,1fr)_96px_120px_180px_200px]";

  return (
    // sayfa genel metin rengi
    <div className="space-y-6 text-gray-800 dark:text-white/90">
      <PageMeta title="Üretim Tamamlama" description="Üretimdeki kayıtları tamamlama" />
      <PageBreadcrumb pageTitle="Üretim Tamamlama" />

      <ComponentCard title="Varsayılan Depo & Lokasyon">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Varsayılan Depo</Label>
            <Select
              options={warehouseOptions}
              value={globalWarehouse}
              onChange={async (v:string)=>{ setGlobalWarehouse(v); const locs=await ensureLocations(v); setGlobalLocation(locs[0]?.id?String(locs[0].id):""); }}
              placeholder="Seçiniz"
            />
          </div>
          <div>
            <Label>Varsayılan Lokasyon</Label>
            <Select options={globalLocationOptions} value={globalLocation} onChange={setGlobalLocation} placeholder="Seçiniz" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="outline" onClick={()=>applyTo("selected")} disabled={!globalWarehouse||!globalLocation||selectedIds.size===0}>Seçilenlere Uygula</Button>
          <Button variant="outline" onClick={()=>applyTo("all")} disabled={!globalWarehouse||!globalLocation||rows.length===0}>Tümüne Uygula</Button>
        </div>
      </ComponentCard>

      <ComponentCard title={`Satırlar (${rows.length})`}>
        {/* hata kutusu dark renkleri */}
        {error && (
          <div className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="mb-2 flex items-center gap-3">
          <Checkbox checked={allSelected} onChange={toggleAll} />
          <span className="text-sm">Tümünü Seç</span>
          <span className="ml-auto text-xs text-gray-500 dark:text-white/50">Seçili: {selectedIds.size}</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[1100px]">
            {/* başlık satırı için muted metin rengi */}
            <div className={`hidden md:grid py-2 text-xs font-medium text-gray-500 dark:text-white/60 ${GRID_COLS}`}>
              <div className="px-3" />
              <div className="px-3 text-left">Tanım</div>
              <div className="px-3 text-left">Barkod</div>
              <div className="px-3 text-left">Miktar</div>
              <div className="px-3 text-left">En × Boy</div>
              <div className="px-3 text-left">Depo</div>
              <div className="px-3 text-left">Lokasyon</div>
            </div>

            {/* ayırıcı ve boş durum renkleri */}
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {rows.length===0 ? (
                <div className="px-4 py-6 text-sm text-gray-500 dark:text-white/50">Kayıt yok.</div>
              ) : rows.map(r=>{
                const wh = r.warehouse_id ? String(r.warehouse_id) : "";
                const locOpts = [{ value:"", label:"Seçiniz", disabled:true },
                  ...(((wh ? locationsByWarehouse[Number(wh)] : []) || []).map(l=>({ value:String(l.id), label:l.name })) as any)];

                return (
                  <div key={`${r.kind}-${r.id}`} className={`grid items-center gap-0 py-2 ${GRID_COLS}`}>
                    <div className="px-3"><Checkbox checked={isSelected(r)} onChange={()=>toggleOne(r)} /></div>
                    <div className="px-3"><span className="truncate text-sm">{labelOf(r)}</span></div>
                    <div className="px-3"><span className="truncate text-sm">{r.barcode}</span></div>
                    <div className="px-3"><span className="text-sm">{fmtQty(r)}</span></div>
                    <div className="px-3"><span className="text-sm">{fmtDim(r)}</span></div>
                    <div className="px-3">
                      <Select className="w-full" options={warehouseOptions} value={wh}
                        onChange={async (v:string)=>{ const locs=await ensureLocations(v); const nextLoc=String(locs[0]?.id||"");
                          setRows(prev=>prev.map(x=>x.id===r.id&&x.kind===r.kind?{...x,warehouse_id:v?Number(v):undefined,location_id:v?Number(nextLoc):undefined}:x)); }}
                        placeholder="Seçiniz" />
                    </div>
                    <div className="px-3">
                      <Select className="w-full" options={locOpts} value={r.location_id?String(r.location_id):""}
                        onChange={(v:string)=>setRows(prev=>prev.map(x=>x.id===r.id&&x.kind===r.kind?{...x,location_id:v?Number(v):undefined}:x))}
                        placeholder="Seçiniz" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={handleApproveSelected} disabled={loading || selectedIds.size===0}>Seçilen Üretimleri Tamamla</Button>
        </div>
      </ComponentCard>
    </div>
  );
}
