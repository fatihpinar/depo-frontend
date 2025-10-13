import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";

/* UI */
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";

/* ---------------- Types ---------------- */
type Category  = { id: number; name: string };
type TypeRow   = { id: number; name: string; category_id?: number };
type Warehouse = { id: number; name: string };
type Location  = { id: number; name: string; warehouse_id: number };
type Master    = {
  id: number;
  display_label: string;
  default_unit?: "EA" | "M" | "KG";
  type_id?: number;
  type_name?: string;
};

const UNIT_LABEL: Record<string, string> = {
  EA: "Adet",
  M:  "Uzunluk",
  KG: "Ağırlık",
};

export default function StockEntry() {
  const location = useLocation() as any;
  const preset = (location.state || {}) as {
    categoryName?: string;
    typeId?: string;
    masterId?: string;
  };

  /* lookups */
  const [categories, setCategories] = useState<Category[]>([]);
  const [types, setTypes]           = useState<TypeRow[]>([]);
  const [mastersRaw, setMastersRaw] = useState<Master[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] =
    useState<Record<number, Location[]>>({});

  /* selections */
  const [categoryName, setCategoryName]   = useState<string>("");
  const [typeId, setTypeId]               = useState<string>("");
  const [selectedMasterId, setSelectedId] = useState<string>("");

  /* derived */
  const filteredMasters = useMemo(() => {
    if (!typeId) return [];
    const idNum = Number(typeId);
    return mastersRaw.filter((m) =>
      (m.type_id && Number(m.type_id) === idNum) ||
      (!m.type_id && m.type_name && types.find(t => t.id === idNum)?.name === m.type_name)
    );
  }, [mastersRaw, typeId, types]);

  const selectedMaster = useMemo(
    () => filteredMasters.find(m => String(m.id) === String(selectedMasterId)) || null,
    [filteredMasters, selectedMasterId]
  );

  /* stock entry state */
  // Artık “Adet” sayısı (her birim için)
  const [count, setCount] = useState<string>("");

  // Satır-temelli state
  const [rows, setRows] = useState<string[]>([]);
  const [barcodes, setBarcodes] = useState<Record<string, string>>({});
  const [rowWarehouses, setRowWarehouses] = useState<Record<string, string>>({});
  const [rowLocations,  setRowLocations]  = useState<Record<string, string>>({});

  // Yeni: satır miktarları (EA’de 1, M/KG’de kullanıcı girer)
  const [rowQuantities, setRowQuantities] = useState<Record<string, string>>({});
  // Yeni: satır en/boy
  const [rowWidths, setRowWidths]   = useState<Record<string, string>>({});
  const [rowHeights, setRowHeights] = useState<Record<string, string>>({});

  // Varsayılan depo/lokasyon (satırlara yayılır)
  const [globalWarehouse, setGlobalWarehouse] = useState<string>("");
  const [globalLocation,  setGlobalLocation]  = useState<string>("");

  /* computed */
  const unitToken  = selectedMaster?.default_unit || "EA";

  const canEnterCount     = !!selectedMaster;
  const isContinueEnabled = canEnterCount && count && Number(count) > 0;

  const isStockSaveEnabled =
    rows.length > 0 &&
    rows.every((label) => {
      const bc  = String(barcodes[label] || "").trim() !== "";
      const wh  = !!rowWarehouses[label];
      const loc = !!rowLocations[label];
      const qtyOk =
        unitToken === "EA"
          ? true
          : (Number(rowQuantities[label] || 0) > 0);
      return bc && wh && loc && qtyOk;
    });

  /* loaders */
  useEffect(() => {
    api.get("/lookups/categories").then(r => setCategories(r.data));
    api.get("/lookups/warehouses").then(r => setWarehouses(r.data));
  }, []);

  // preset: ilk render'da kategori
  useEffect(() => {
    if (preset.categoryName) setCategoryName(preset.categoryName);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // kategori değişince: tür + masterları çek
  useEffect(() => {
    const cat = categories.find(c => c.name === categoryName);
    setTypeId("");
    setSelectedId("");
    setMastersRaw([]);
    resetRows();

    if (!cat) { setTypes([]); return; }

    api.get(`/lookups/types/${cat.id}`).then(r => setTypes(r.data));
    api.get(`masters?categoryId=${cat.id}`).then(r => setMastersRaw(r.data));
  }, [categoryName, categories]);

  // type preset
  useEffect(() => {
    if (!preset.typeId) return;
    if (categoryName && types.length > 0) {
      const exists = !!types.find((t) => String(t.id) === String(preset.typeId));
      if (exists) setTypeId(String(preset.typeId));
    }
  }, [types, categoryName, preset.typeId]);

  // type değişince masterları daralt, seçimleri sıfırla
  useEffect(() => {
    const cat = categories.find(c => c.name === categoryName);
    if (!cat || !typeId) return;

    const tryFetch = async () => {
      try {
        const res = await api.get(`masters?categoryId=${cat.id}&typeId=${typeId}`);
        if (Array.isArray(res.data)) setMastersRaw(res.data);
      } catch {/* sessiz */}
    };
    tryFetch();
    setSelectedId("");
    resetRows();
  }, [typeId, categoryName, categories]);

  // master preset
  useEffect(() => {
    if (!preset.masterId) return;
    if (filteredMasters.length > 0) {
      const exists = !!filteredMasters.find((m) => String(m.id) === String(preset.masterId));
      if (exists) setSelectedId(String(preset.masterId));
    }
  }, [filteredMasters, preset.masterId]);

  // depo -> lokasyon cache
  const ensureLocations = async (warehouseId: string | number) => {
    const id = Number(warehouseId);
    if (!id) return [];
    if (locationsByWarehouse[id]) return locationsByWarehouse[id];
    const res = await api.get(`/lookups/locations?warehouseId=${id}`);
    const list: Location[] = res.data || [];
    setLocationsByWarehouse(prev => ({ ...prev, [id]: list }));
    return list;
  };

  /* reset helper */
  const resetRows = () => {
    setCount("");
    setRows([]);
    setBarcodes({});
    setRowWarehouses({});
    setRowLocations({});
    setRowQuantities({});
    setRowWidths({});
    setRowHeights({});
    setGlobalWarehouse("");
    setGlobalLocation("");
  };

  /* continue -> create rows by count (all units) */
  const handleContinue = async () => {
    const n = Math.max(0, parseInt(count || "0", 10));
    const newRows = Array.from({ length: n }, (_, i) => `Satır ${i + 1}`);
    setRows(newRows);

    // Barkod ve depo/lokasyon varsayılanları
    setBarcodes({});
    // Miktarlar:
    if (unitToken === "EA") {
      // hepsi 1 (değiştirilemez)
      setRowQuantities(Object.fromEntries(newRows.map(lbl => [lbl, "1"])));
    } else {
      // boş başlat
      setRowQuantities(Object.fromEntries(newRows.map(lbl => [lbl, ""])));
    }

    // en/boy boş
    setRowWidths(Object.fromEntries(newRows.map(lbl => [lbl, ""])));
    setRowHeights(Object.fromEntries(newRows.map(lbl => [lbl, ""])));

    if (globalWarehouse) {
      const locs = await ensureLocations(globalWarehouse);
      const firstLocId = locs[0]?.id || "";
      setRowWarehouses(Object.fromEntries(newRows.map((lbl) => [lbl, globalWarehouse])));
      setRowLocations(Object.fromEntries(newRows.map((lbl) => [lbl, String(firstLocId)])));
      setGlobalLocation(String(firstLocId));
    } else {
      setRowWarehouses(Object.fromEntries(newRows.map((lbl) => [lbl, ""])));
      setRowLocations(Object.fromEntries(newRows.map((lbl) => [lbl, ""])));
    }
  };

  /* barcode change */
  const handleBarcodeChange = (row: string, value: string) => {
    setBarcodes(prev => ({ ...prev, [row]: value }));
  };

  /* save stock */
  const handleStockSave = async () => {
    try {
      if (!selectedMaster) { alert("Önce bir tanım (master) seçmelisiniz."); return; }
      if (!rows.length)     { alert("Önce adet girip 'Devam Et' demelisiniz."); return; }

      const problems: string[] = [];
      rows.forEach((label) => {
        const bc  = String(barcodes[label] || "").trim();
        const wh  = rowWarehouses[label];
        const loc = rowLocations[label];
        const qty = rowQuantities[label];

        if (!bc)  problems.push(`${label}: Barkod boş`);
        if (!wh)  problems.push(`${label}: Depo seçilmemiş`);
        if (!loc) problems.push(`${label}: Lokasyon seçilmemiş`);

        if (unitToken !== "EA") {
          if (!(Number(qty) > 0)) problems.push(`${label}: Miktar (>0) zorunlu`);
        }
      });
      if (problems.length) { alert("Eksik/hatali alanlar:\n- " + problems.join("\n- ")); return; }

      const payload = rows.map((label) => {
        const qty = unitToken === "EA" ? 1 : Number(rowQuantities[label] || 0);
        const width  = rowWidths[label]   ? Number(rowWidths[label])   : undefined;
        const height = rowHeights[label]  ? Number(rowHeights[label])  : undefined;

        return {
          master_id: selectedMaster.id,
          barcode: String(barcodes[label]).trim(),
          unit: unitToken as "EA" | "M" | "KG",
          quantity: qty,
          warehouse_id: Number(rowWarehouses[label]),
          location_id: Number(rowLocations[label]),
          width,   // yeni
          height,  // yeni
        };
      });

      const res = await api.post("/components/bulk", payload);
      alert(`Stok kaydı tamamlandı! (${res?.data?.length ?? payload.length} satır)`);
      resetRows();
    } catch (err: any) {
      console.error("Stok kaydı hatası:", err);
      const status = err?.response?.status;
      const data   = err?.response?.data;

      if (status === 409 && data?.code === "BARCODE_CONFLICT") {
        const conflicts = (data?.conflicts || []).map((c: any) => `• ${c.barcode}`).join("\n");
        alert(`Bazı barkodlar zaten kayıtlı:\n${conflicts || "Detay yok"}`);
        return;
      }
      if (status === 400 && data?.errors?.length) {
        const msg = data.errors.map((e: any) => `• Satır ${e.index + 1} - ${e.field}: ${e.message}`).join("\n");
        alert(`Validasyon hatası:\n${msg}`);
        return;
      }
      alert("Stok kaydı sırasında beklenmeyen bir hata oluştu.");
    }
  };

  /* options */
  const categoryOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...categories.map((c) => ({ value: c.name, label: c.name })),
  ];
  const typeOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...types.map((t) => ({ value: String(t.id), label: t.name })),
  ];
  const masterOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...filteredMasters.map((m) => ({ value: String(m.id), label: m.display_label })),
  ];
  const warehouseOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...warehouses.map((w) => ({ value: String(w.id), label: w.name })),
  ];
  const globalLocationOptions = [
    { value: "", label: "Seçiniz", disabled: true },
    ...(
      globalWarehouse
        ? locationsByWarehouse[Number(globalWarehouse)] || []
        : []
    ).map((l) => ({ value: String(l.id), label: l.name })),
  ];

  /* UI */
  return (
    <div className="space-y-6">
      <PageMeta title="Stok Girişi" description="Mevcut tanım üzerinden depoya stok girişi" />
      <PageBreadcrumb pageTitle="Stok Girişi" />

      {/* Tanım seçimi */}
      <ComponentCard title="Tanım / Master">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <Label>Kategori</Label>
            <Select
              options={categoryOptions}
              value={categoryName}
              placeholder="Seçiniz"
              onChange={(val: string) => {
                setCategoryName(val);
              }}
            />
          </div>

          <div>
            <Label>Tür</Label>
            <Select
              options={typeOptions}
              value={typeId}
              placeholder="Seçiniz"
              onChange={(val: string) => {
                setTypeId(val);
              }}
            />
          </div>

          <div className="md:col-span-2">
            <Label>Tanım Seçimi</Label>
            <Select
              options={masterOptions}
              value={selectedMasterId}
              placeholder="Seçiniz"
              onChange={(val: string) => {
                setSelectedId(val);
                resetRows();
              }}
            />
          </div>
        </div>

        {selectedMaster && (
          <div className="mt-3 text-sm text-gray-500 dark:text-gray-400">
            Ölçü birimi: <b>{UNIT_LABEL[selectedMaster.default_unit || "EA"] || "Adet"}</b>
          </div>
        )}
      </ComponentCard>

      {/* Adet */}
      {!!selectedMaster && (
        <ComponentCard title="Adet">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="md:col-span-2">
              <Label>Adet</Label>
              <Input
                type="number"
                value={count}
                onChange={(e) => setCount(e.target.value)}
                placeholder="Örn: 2"
              />
              {unitToken !== "EA" && (
                <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                  Not: {UNIT_LABEL[unitToken]} cinsinden **miktarları** her satırda ayrı ayrı gireceksiniz.
                </p>
              )}
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                variant="primary"
                disabled={!isContinueEnabled}
                onClick={handleContinue}
              >
                Devam Et
              </Button>
            </div>
          </div>
        </ComponentCard>
      )}

      {/* Global depo/lokasyon + satırlar */}
      {rows.length > 0 && (
        <div className="space-y-6">
          <ComponentCard title="Varsayılan Depo & Lokasyon">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label>Varsayılan Depo</Label>
                <Select
                  options={warehouseOptions}
                  value={globalWarehouse}
                  placeholder="Seçiniz"
                  onChange={async (val: string) => {
                    setGlobalWarehouse(val);
                    const locs = await ensureLocations(val);
                    const firstLocId = locs[0]?.id || "";
                    setRowWarehouses(Object.fromEntries(rows.map((lbl) => [lbl, val])));
                    setRowLocations(Object.fromEntries(rows.map((lbl) => [lbl, String(firstLocId)])));
                    setGlobalLocation(String(firstLocId));
                  }}
                />
              </div>

              <div>
                <Label>Varsayılan Lokasyon</Label>
                <Select
                  options={globalLocationOptions}
                  value={globalLocation}
                  placeholder="Seçiniz"
                  onChange={(val: string) => {
                    setGlobalLocation(val);
                    setRowLocations(Object.fromEntries(rows.map((lbl) => [lbl, val])));
                  }}
                />
              </div>
            </div>
          </ComponentCard>

          <ComponentCard title="Satırlar">
            <div className="space-y-4">
              {rows.map((rowLabel, i) => {
                const wh = rowWarehouses[rowLabel] || "";
                const locOptions = [
                  { value: "", label: "Seçiniz", disabled: true },
                  ...(
                    wh ? (locationsByWarehouse[Number(wh)] || []) : []
                  ).map((l) => ({ value: String(l.id), label: l.name })),
                ];

                const qtyVal = rowQuantities[rowLabel] ?? (unitToken === "EA" ? "1" : "");
                const widthVal  = rowWidths[rowLabel]  ?? "";
                const heightVal = rowHeights[rowLabel] ?? "";

                return (
                  <div
                    key={i}
                    className="grid grid-cols-1 items-end gap-4 md:grid-cols-[1fr_2fr_minmax(120px,1fr)_minmax(120px,1fr)_minmax(120px,1fr)_minmax(160px,1fr)_minmax(160px,1fr)]"
                  >
                    <div className="text-sm font-medium text-gray-700 dark:text-gray-200">
                      {rowLabel}
                    </div>

                    <div>
                      <Label>Barkod</Label>
                      <Input
                        type="text"
                        value={barcodes[rowLabel] || ""}
                        onChange={(e) => handleBarcodeChange(rowLabel, e.target.value)}
                        placeholder="Barkod"
                      />
                    </div>

                    <div>
                      <Label>Miktar {unitToken !== "EA" ? `(${UNIT_LABEL[unitToken]})` : ""}</Label>
                      {unitToken === "EA" ? (
                        <Input disabled value="1" />
                      ) : (
                        <Input
                          type="number"
                          min="0"
                          value={qtyVal}
                          onChange={(e) =>
                            setRowQuantities((prev) => ({ ...prev, [rowLabel]: e.target.value }))
                          }
                          placeholder={`Örn: ${unitToken === "KG" ? "3" : "5"}`}
                        />
                      )}
                    </div>

                    <div>
                      <Label>En</Label>
                      <Input
                        type="number"
                        min="0"
                        value={widthVal}
                        onChange={(e) => setRowWidths((prev) => ({ ...prev, [rowLabel]: e.target.value }))}
                        placeholder="Opsiyonel"
                      />
                    </div>

                    <div>
                      <Label>Boy</Label>
                      <Input
                        type="number"
                        min="0"
                        value={heightVal}
                        onChange={(e) => setRowHeights((prev) => ({ ...prev, [rowLabel]: e.target.value }))}
                        placeholder="Opsiyonel"
                      />
                    </div>

                    <div>
                      <Label>Depo</Label>
                      <Select
                        options={warehouseOptions}
                        value={rowWarehouses[rowLabel] || ""}
                        placeholder="Seçiniz"
                        onChange={async (val: string) => {
                          setRowWarehouses((prev) => ({ ...prev, [rowLabel]: val }));
                          const locs = await ensureLocations(val);
                          const current   = rowLocations[rowLabel];
                          const stillOk   = !!locs.find(l => String(l.id) === String(current));
                          const nextLocId = stillOk ? current : String(locs[0]?.id || "");
                          setRowLocations((prev) => ({ ...prev, [rowLabel]: nextLocId }));
                        }}
                      />
                    </div>

                    <div>
                      <Label>Lokasyon</Label>
                      <Select
                        options={locOptions}
                        value={rowLocations[rowLabel] || ""}
                        placeholder="Seçiniz"
                        onChange={(val: string) =>
                          setRowLocations((prev) => ({ ...prev, [rowLabel]: val }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 flex justify-end">
              <Button
                variant="primary"
                onClick={handleStockSave}
                disabled={!isStockSaveEnabled}
              >
                Stok Kaydet
              </Button>
            </div>
          </ComponentCard>
        </div>
      )}
    </div>
  );
}
