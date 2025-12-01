// src/pages/Stock/StockEntry.tsx

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useLocation } from "react-router-dom";
import api from "../../services/api";

/* UI Components */
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Select from "../../components/form/Select";
import Button from "../../components/ui/button/Button";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import PageMeta from "../../components/common/PageMeta";
import Alert from "../../components/ui/alert/Alert";

/* ============= TYPE DEFINITIONS ============= */

interface ProductType {
  id: number;
  name: string;
}

interface CarrierType {
  id: number;
  name: string;
}

interface SimpleLookup {
  id: number;
  name: string;
  display_code?: string;
}

interface Warehouse {
  id: number;
  name: string;
}

interface Location {
  id: number;
  name: string;
  warehouse_id: number;
}

interface Master {
  id: number;
  display_label: string;
  default_unit?: "EA" | "M" | "KG";
  product_type_id?: number;
  carrier_type_id?: number;
  bimeks_code?: string;
  bimeks_product_name?: string;
  length_unit?: "m" | "um";
  supplier_id?: number;
  supplier_name?: string;
  supplier_product_code?: string;
}

interface Row {
  id: string;
  master_id: number;
  display_label: string;
  qty: number;
  width?: string;
  height?: string;
  warehouse_id?: string;
  location_id?: string;
  invoice_no?: string;
  length_unit?: "m" | "um";
}

interface AlertState {
  variant: "success" | "error" | "warning" | "info";
  title: string;
  message: string;
}

interface GlobalSettings {
  invoice: string;
  warehouse: string;
  location: string;
}

/* ============= UTILITIES ============= */
const uid = (): string => Math.random().toString(36).slice(2);

const createSelectOption = (
  value: string | number,
  label: string,
  disabled = false
) => ({
  value: String(value),
  label,
  disabled,
});

const EMPTY_SELECT_OPTION = createSelectOption("", "Seçiniz", true);

/* ============= MASTER INLINE FORM COMPONENT ============= */
interface MasterInlineFormProps {
  onSaved: (saved: { id: number; display_label: string }) => void;
  onCancel?: () => void;
}

function MasterInlineForm({ onSaved, onCancel }: MasterInlineFormProps) {
  // Lookups
  const [productTypes, setProductTypes] = useState<ProductType[]>([]);
  const [suppliers, setSuppliers] = useState<SimpleLookup[]>([]);
  const [carrierTypes, setCarrierTypes] = useState<SimpleLookup[]>([]);
  const [carrierColors, setCarrierColors] = useState<SimpleLookup[]>([]);
  const [linerColors, setLinerColors] = useState<SimpleLookup[]>([]);
  const [linerTypes, setLinerTypes] = useState<SimpleLookup[]>([]);
  const [adhesiveTypes, setAdhesiveTypes] = useState<SimpleLookup[]>([]);
  const [lengthUnit, setLengthUnit] = useState<"m" | "um">("m");

  // Form values
  const [productTypeId, setProductTypeId] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierProductCode, setSupplierProductCode] = useState("");
  const [bimeksProductName, setBimeksProductName] = useState("");
  const [thickness, setThickness] = useState("");
  const [carrierDensity, setCarrierDensity] = useState("");
  const [carrierTypeId, setCarrierTypeId] = useState("");
  const [carrierColorId, setCarrierColorId] = useState("");
  const [linerColorId, setLinerColorId] = useState("");
  const [linerTypeId, setLinerTypeId] = useState("");
  const [adhesiveTypeId, setAdhesiveTypeId] = useState("");
  const [bimeksCode, setBimeksCode] = useState("");

  // Yeni kayıt flag + inputları
  const [addingSupplier, setAddingSupplier] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState("");
  const [newSupplierCode, setNewSupplierCode] = useState("");

  const [addingCarrierType, setAddingCarrierType] = useState(false);
  const [newCarrierTypeName, setNewCarrierTypeName] = useState("");
  const [newCarrierTypeCode, setNewCarrierTypeCode] = useState("");

  const [addingCarrierColor, setAddingCarrierColor] = useState(false);
  const [newCarrierColorName, setNewCarrierColorName] = useState("");
  const [newCarrierColorCode, setNewCarrierColorCode] = useState("");

  const [addingLinerColor, setAddingLinerColor] = useState(false);
  const [newLinerColorName, setNewLinerColorName] = useState("");
  const [newLinerColorCode, setNewLinerColorCode] = useState("");

  const [addingLinerType, setAddingLinerType] = useState(false);
  const [newLinerTypeName, setNewLinerTypeName] = useState("");
  const [newLinerTypeCode, setNewLinerTypeCode] = useState("");

  const [addingAdhesiveType, setAddingAdhesiveType] = useState(false);
  const [newAdhesiveTypeName, setNewAdhesiveTypeName] = useState("");
  const [newAdhesiveTypeCode, setNewAdhesiveTypeCode] = useState("");

  const [saving, setSaving] = useState(false);

  // Initial data load
  useEffect(() => {
    (async () => {
      try {
        const [
          productTypesRes,
          suppliersRes,
          carrierTypesRes,
          carrierColorsRes,
          linerColorsRes,
          linerTypesRes,
          adhesiveTypesRes,
        ] = await Promise.all([
          api.get("/lookups/product-types"),
          api.get("/lookups/suppliers"),
          api.get("/lookups/carrier-types"),
          api.get("/lookups/carrier-colors"),
          api.get("/lookups/liner-colors"),
          api.get("/lookups/liner-types"),
          api.get("/lookups/adhesive-types"),
        ]);

        setProductTypes(productTypesRes.data || []);
        setSuppliers(suppliersRes.data || []);
        setCarrierTypes(carrierTypesRes.data || []);
        setCarrierColors(carrierColorsRes.data || []);
        setLinerColors(linerColorsRes.data || []);
        setLinerTypes(linerTypesRes.data || []);
        setAdhesiveTypes(adhesiveTypesRes.data || []);
      } catch (err) {
        console.error("Master lookups load error:", err);
        alert("Tanım için gerekli listeler yüklenirken bir hata oluştu.");
      }
    })();
  }, []);

  // ----- OPTIONS -----
  const supplierOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...suppliers.map((s) => createSelectOption(s.id, s.name)),
      createSelectOption("new", "+ Yeni Tedarikçi Ekle"),
    ],
    [suppliers]
  );

  const productTypeOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...productTypes.map((p) => createSelectOption(p.id, p.name)),
    ],
    [productTypes]
  );

  const carrierTypeOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...carrierTypes.map((t) => createSelectOption(t.id, t.name)),
      createSelectOption("new", "+ Yeni Taşıyıcı Türü Ekle"),
    ],
    [carrierTypes]
  );

  const carrierColorOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...carrierColors.map((c) => createSelectOption(c.id, c.name)),
      createSelectOption("new", "+ Yeni Taşıyıcı Renk Ekle"),
    ],
    [carrierColors]
  );

  const linerColorOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...linerColors.map((c) => createSelectOption(c.id, c.name)),
      createSelectOption("new", "+ Yeni Liner Renk Ekle"),
    ],
    [linerColors]
  );

  const linerTypeOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...linerTypes.map((t) => createSelectOption(t.id, t.name)),
      createSelectOption("new", "+ Yeni Liner Türü Ekle"),
    ],
    [linerTypes]
  );

  const adhesiveTypeOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...adhesiveTypes.map((t) => createSelectOption(t.id, t.name)),
      createSelectOption("new", "+ Yeni Yapışkan Türü Ekle"),
    ],
    [adhesiveTypes]
  );

  const lengthUnitOptions = [
    createSelectOption("m", "Metre (m)"),
    createSelectOption("um", "Mikron (µm)"),
  ];

  // ----- ON CHANGE HANDLERS -----
  const handleSupplierChange = (val: string) => {
    if (val === "new") {
      setAddingSupplier(true);
      setSupplierId("");
    } else {
      setAddingSupplier(false);
      setNewSupplierName("");
      setNewSupplierCode("");
      setSupplierId(val);
    }
  };

  const handleCarrierTypeChange = (val: string) => {
    if (val === "new") {
      setAddingCarrierType(true);
      setCarrierTypeId("");
    } else {
      setAddingCarrierType(false);
      setNewCarrierTypeName("");
      setNewCarrierTypeCode("");
      setCarrierTypeId(val);
    }
  };

  const handleCarrierColorChange = (val: string) => {
    if (val === "new") {
      setAddingCarrierColor(true);
      setCarrierColorId("");
    } else {
      setAddingCarrierColor(false);
      setNewCarrierColorName("");
      setNewCarrierColorCode("");
      setCarrierColorId(val);
    }
  };

  const handleLinerColorChange = (val: string) => {
    if (val === "new") {
      setAddingLinerColor(true);
      setLinerColorId("");
    } else {
      setAddingLinerColor(false);
      setNewLinerColorName("");
      setNewLinerColorCode("");
      setLinerColorId(val);
    }
  };

  const handleLinerTypeChange = (val: string) => {
    if (val === "new") {
      setAddingLinerType(true);
      setLinerTypeId("");
    } else {
      setAddingLinerType(false);
      setNewLinerTypeName("");
      setNewLinerTypeCode("");
      setLinerTypeId(val);
    }
  };

  const handleAdhesiveTypeChange = (val: string) => {
    if (val === "new") {
      setAddingAdhesiveType(true);
      setAdhesiveTypeId("");
    } else {
      setAddingAdhesiveType(false);
      setNewAdhesiveTypeName("");
      setNewAdhesiveTypeCode("");
      setAdhesiveTypeId(val);
    }
  };

  // ----- VALIDATION -----
  const validate = (): string[] => {
    const missing: string[] = [];

    if (!productTypeId) missing.push("Ürün Türü");
    if (!addingSupplier && !supplierId) missing.push("Tedarikçi");
    if (!addingCarrierType && !carrierTypeId) missing.push("Taşıyıcı Türü");
    if (!addingCarrierColor && !carrierColorId) missing.push("Taşıyıcı Renk");
    if (!addingLinerColor && !linerColorId) missing.push("Liner Renk");
    if (!addingLinerType && !linerTypeId) missing.push("Liner Türü");
    if (!addingAdhesiveType && !adhesiveTypeId) missing.push("Yapışkan Türü");
    if (!lengthUnit) missing.push("Stok Ölçü Birimi");

    if (!bimeksProductName.trim()) missing.push("Bimeks Ürün Tanımı");
    if (!supplierProductCode.trim()) missing.push("Tedarikçi Ürün Kodu");

    if (addingSupplier) {
      if (!newSupplierName.trim()) missing.push("Yeni Tedarikçi Adı");
      if (!newSupplierCode.trim()) missing.push("Yeni Tedarikçi Kodu");
    }
    if (addingCarrierType) {
      if (!newCarrierTypeName.trim()) missing.push("Yeni Taşıyıcı Türü Adı");
      if (!newCarrierTypeCode.trim()) missing.push("Yeni Taşıyıcı Türü Kodu");
    }
    if (addingCarrierColor) {
      if (!newCarrierColorName.trim()) missing.push("Yeni Taşıyıcı Renk Adı");
      if (!newCarrierColorCode.trim()) missing.push("Yeni Taşıyıcı Renk Kodu");
    }
    if (addingLinerColor) {
      if (!newLinerColorName.trim()) missing.push("Yeni Liner Renk Adı");
      if (!newLinerColorCode.trim()) missing.push("Yeni Liner Renk Kodu");
    }
    if (addingLinerType) {
      if (!newLinerTypeName.trim()) missing.push("Yeni Liner Türü Adı");
      if (!newLinerTypeCode.trim()) missing.push("Yeni Liner Türü Kodu");
    }
    if (addingAdhesiveType) {
      if (!newAdhesiveTypeName.trim()) missing.push("Yeni Yapışkan Türü Adı");
      if (!newAdhesiveTypeCode.trim()) missing.push("Yeni Yapışkan Türü Kodu");
    }

    return missing;
  };

  // ----- SAVE -----
  const handleSave = async () => {
    const missing = validate();
    if (missing.length) {
      alert("Zorunlu alan(lar) eksik:\n- " + missing.join("\n- "));
      return;
    }

    setSaving(true);
    try {
      let finalSupplierId: number | null = supplierId ? Number(supplierId) : null;

      if (addingSupplier) {
        const name = newSupplierName.trim();
        const code = newSupplierCode.trim();

        const exists = suppliers.find(
          (s) => s.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalSupplierId = exists.id;
        } else {
          const supRes = await api.post("/lookups/suppliers", {
            name,
            display_code: code,
          });
          finalSupplierId = supRes.data.id;
          setSuppliers((prev) => [...prev, supRes.data]);
        }
      }

      let finalCarrierTypeId: number | null = carrierTypeId
        ? Number(carrierTypeId)
        : null;
      if (addingCarrierType) {
        const name = newCarrierTypeName.trim();
        const code = newCarrierTypeCode.trim();
        const exists = carrierTypes.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalCarrierTypeId = exists.id;
        } else {
          const res = await api.post("/lookups/carrier-types", {
            name,
            display_code: code,
          });
          finalCarrierTypeId = res.data.id;
          setCarrierTypes((prev) => [...prev, res.data]);
        }
      }

      let finalCarrierColorId: number | null = carrierColorId
        ? Number(carrierColorId)
        : null;
      if (addingCarrierColor) {
        const name = newCarrierColorName.trim();
        const code = newCarrierColorCode.trim();
        const exists = carrierColors.find(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalCarrierColorId = exists.id;
        } else {
          const res = await api.post("/lookups/carrier-colors", {
            name,
            display_code: code,
          });
          finalCarrierColorId = res.data.id;
          setCarrierColors((prev) => [...prev, res.data]);
        }
      }

      let finalLinerColorId: number | null = linerColorId
        ? Number(linerColorId)
        : null;
      if (addingLinerColor) {
        const name = newLinerColorName.trim();
        const code = newLinerColorCode.trim();
        const exists = linerColors.find(
          (c) => c.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalLinerColorId = exists.id;
        } else {
          const res = await api.post("/lookups/liner-colors", {
            name,
            display_code: code,
          });
          finalLinerColorId = res.data.id;
          setLinerColors((prev) => [...prev, res.data]);
        }
      }

      let finalLinerTypeId: number | null = linerTypeId
        ? Number(linerTypeId)
        : null;
      if (addingLinerType) {
        const name = newLinerTypeName.trim();
        const code = newLinerTypeCode.trim();
        const exists = linerTypes.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalLinerTypeId = exists.id;
        } else {
          const res = await api.post("/lookups/liner-types", {
            name,
            display_code: code,
          });
          finalLinerTypeId = res.data.id;
          setLinerTypes((prev) => [...prev, res.data]);
        }
      }

      let finalAdhesiveTypeId: number | null = adhesiveTypeId
        ? Number(adhesiveTypeId)
        : null;
      if (addingAdhesiveType) {
        const name = newAdhesiveTypeName.trim();
        const code = newAdhesiveTypeCode.trim();
        const exists = adhesiveTypes.find(
          (t) => t.name.toLowerCase() === name.toLowerCase()
        );
        if (exists) {
          finalAdhesiveTypeId = exists.id;
        } else {
          const res = await api.post("/lookups/adhesive-types", {
            name,
            display_code: code,
          });
          finalAdhesiveTypeId = res.data.id;
          setAdhesiveTypes((prev) => [...prev, res.data]);
        }
      }

      const payload: Record<string, any> = {
        product_type_id: Number(productTypeId),
        supplier_id: finalSupplierId,
        supplier_product_code: supplierProductCode.trim(),
        bimeks_product_name: bimeksProductName.trim(),
        carrier_type_id: finalCarrierTypeId,
        carrier_color_id: finalCarrierColorId,
        liner_color_id: finalLinerColorId,
        liner_type_id: finalLinerTypeId,
        adhesive_type_id: finalAdhesiveTypeId,
        thickness: thickness ? Number(thickness) : null,
        carrier_density: carrierDensity ? Number(carrierDensity) : null,
        length_unit: lengthUnit,
      };

      const res = await api.post("/masters", payload);
      const created: Master = res.data;

      setBimeksCode(created.bimeks_code || "");

      const display =
        created.display_label ||
        `${created.bimeks_code ?? ""} - ${created.bimeks_product_name ?? bimeksProductName}`.trim();

      alert("Tanım kaydedildi.");

      onSaved({
        id: created.id,
        display_label: display,
      });

      // Form reset
      setProductTypeId("");
      setSupplierId("");
      setSupplierProductCode("");
      setBimeksProductName("");
      setThickness("");
      setCarrierDensity("");
      setCarrierTypeId("");
      setCarrierColorId("");
      setLinerColorId("");
      setLinerTypeId("");
      setAdhesiveTypeId("");
      setAddingSupplier(false);
      setNewSupplierName("");
      setNewSupplierCode("");
      setAddingCarrierType(false);
      setNewCarrierTypeName("");
      setNewCarrierTypeCode("");
      setAddingCarrierColor(false);
      setNewCarrierColorName("");
      setNewCarrierColorCode("");
      setAddingLinerColor(false);
      setNewLinerColorName("");
      setNewLinerColorCode("");
      setAddingLinerType(false);
      setNewLinerTypeName("");
      setNewLinerTypeCode("");
      setAddingAdhesiveType(false);
      setNewAdhesiveTypeName("");
      setNewAdhesiveTypeCode("");

      onCancel?.();
    } catch (err: any) {
      console.error("Master kaydetme hatası:", err);
      const { status, data } = err?.response || {};

      if (status === 409 && (data?.code === "duplicate_name" || data?.error === "duplicate_name")) {
        alert("Aynı özelliklere sahip bir Bimeks tanımı zaten mevcut.");
      } else if (status === 400) {
        alert(data?.message || "Zorunlu alanlar eksik veya hatalı.");
      } else {
        alert("Beklenmeyen bir hata oluştu.");
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>
            Ürün Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            options={productTypeOptions}
            value={productTypeId}
            onChange={setProductTypeId}
            placeholder="Seçiniz"
          />
        </div>

        <div>
          <Label>
            Tedarikçi <span className="text-red-500">*</span>
          </Label>
          <Select
            options={supplierOptions}
            value={supplierId}
            onChange={handleSupplierChange}
            placeholder="Seçiniz"
          />
          {addingSupplier && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Tedarikçi Adı</Label>
                <Input
                  type="text"
                  value={newSupplierName}
                  onChange={(e) => setNewSupplierName(e.target.value)}
                  placeholder="Örn: ACME A.Ş."
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newSupplierCode}
                  onChange={(e) => setNewSupplierCode(e.target.value)}
                  placeholder="Örn: AC"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Taşıyıcı Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            options={carrierTypeOptions}
            value={carrierTypeId}
            onChange={handleCarrierTypeChange}
            placeholder="Seçiniz"
          />
          {addingCarrierType && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Taşıyıcı Türü Adı</Label>
                <Input
                  type="text"
                  value={newCarrierTypeName}
                  onChange={(e) => setNewCarrierTypeName(e.target.value)}
                  placeholder="Örn: PE Köpük"
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newCarrierTypeCode}
                  onChange={(e) => setNewCarrierTypeCode(e.target.value)}
                  placeholder="Örn: CT1"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Taşıyıcı Renk <span className="text-red-500">*</span>
          </Label>
          <Select
            options={carrierColorOptions}
            value={carrierColorId}
            onChange={handleCarrierColorChange}
            placeholder="Seçiniz"
          />
          {addingCarrierColor && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Taşıyıcı Renk Adı</Label>
                <Input
                  type="text"
                  value={newCarrierColorName}
                  onChange={(e) => setNewCarrierColorName(e.target.value)}
                  placeholder="Örn: Beyaz"
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newCarrierColorCode}
                  onChange={(e) => setNewCarrierColorCode(e.target.value)}
                  placeholder="Örn: WH"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Liner Renk <span className="text-red-500">*</span>
          </Label>
          <Select
            options={linerColorOptions}
            value={linerColorId}
            onChange={handleLinerColorChange}
            placeholder="Seçiniz"
          />
          {addingLinerColor && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Liner Renk Adı</Label>
                <Input
                  type="text"
                  value={newLinerColorName}
                  onChange={(e) => setNewLinerColorName(e.target.value)}
                  placeholder="Örn: Sarı"
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newLinerColorCode}
                  onChange={(e) => setNewLinerColorCode(e.target.value)}
                  placeholder="Örn: YL"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Liner Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            options={linerTypeOptions}
            value={linerTypeId}
            onChange={handleLinerTypeChange}
            placeholder="Seçiniz"
          />
          {addingLinerType && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Liner Türü Adı</Label>
                <Input
                  type="text"
                  value={newLinerTypeName}
                  onChange={(e) => setNewLinerTypeName(e.target.value)}
                  placeholder="Örn: Sarı Kağıt"
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newLinerTypeCode}
                  onChange={(e) => setNewLinerTypeCode(e.target.value)}
                  placeholder="Örn: LT1"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Yapışkan Türü <span className="text-red-500">*</span>
          </Label>
          <Select
            options={adhesiveTypeOptions}
            value={adhesiveTypeId}
            onChange={handleAdhesiveTypeChange}
            placeholder="Seçiniz"
          />
          {addingAdhesiveType && (
            <div className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              <div>
                <Label>Yeni Yapışkan Türü Adı</Label>
                <Input
                  type="text"
                  value={newAdhesiveTypeName}
                  onChange={(e) => setNewAdhesiveTypeName(e.target.value)}
                  placeholder="Örn: Akrilik"
                />
              </div>
              <div>
                <Label>Kısaltma / Kod</Label>
                <Input
                  type="text"
                  value={newAdhesiveTypeCode}
                  onChange={(e) => setNewAdhesiveTypeCode(e.target.value)}
                  placeholder="Örn: AD1"
                />
              </div>
            </div>
          )}
        </div>

        <div>
          <Label>
            Stok Ölçü Birimi <span className="text-red-500">*</span>
          </Label>
          <Select
            options={lengthUnitOptions}
            value={lengthUnit}
            onChange={(v: string) => setLengthUnit(v as "m" | "um")}
            placeholder="Metre / Mikron"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <Label>
            Kalınlık (µm) <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            value={thickness}
            onChange={(e) => setThickness(e.target.value)}
            placeholder="Opsiyonel"
          />
        </div>
        <div>
          <Label>
            Taşıyıcı Yoğunluk <span className="text-red-500">*</span>
          </Label>
          <Input
            type="number"
            min="0"
            value={carrierDensity}
            onChange={(e) => setCarrierDensity(e.target.value)}
            placeholder="Opsiyonel"
          />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label>
            Bimeks Ürün Tanımı <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            value={bimeksProductName}
            onChange={(e) => setBimeksProductName(e.target.value)}
            placeholder="Örn: Çift Taraflı Köpük Bant 1mm ..."
          />
        </div>

        <div>
          <Label>
            Tedarikçi Ürün Kodu <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            value={supplierProductCode}
            onChange={(e) => setSupplierProductCode(e.target.value)}
            placeholder="Örn: 3M-9080HL"
          />
        </div>

        <div>
          <Label>Bimeks Kodu</Label>
          <Input
            type="text"
            value={bimeksCode}
            disabled
            placeholder="Kayıt sonrasında otomatik oluşturulacak"
          />
        </div>
      </div>

      <div className="mt-2 flex gap-3">
        <Button variant="primary" onClick={handleSave} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Kaydet"}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Vazgeç
        </Button>
      </div>
    </div>
  );
}

/* ============= STOCK ROW COMPONENT ============= */
interface StockRowProps {
  row: Row;
  warehouseOptions: { value: string; label: string }[];
  locationsByWarehouse: Record<number, Location[]>;
  onUpdate: (id: string, updates: Partial<Row>) => void;
  onClone: (id: string) => void;
  onDelete: (id: string) => void;
  ensureLocations: (warehouseId: string | number) => Promise<Location[]>;
}

function StockRow({
  row,
  warehouseOptions,
  locationsByWarehouse,
  onUpdate,
  onClone,
  onDelete,
  ensureLocations,
}: StockRowProps) {
  const locationOptions = useMemo(() => {
    const wh = row.warehouse_id || "";
    const locations = wh ? locationsByWarehouse[Number(wh)] || [] : [];
    return [
      EMPTY_SELECT_OPTION,
      ...locations.map((l) => createSelectOption(l.id, l.name)),
    ];
  }, [row.warehouse_id, locationsByWarehouse]);

  const handleWarehouseChange = async (val: string) => {
    const locs = await ensureLocations(val);
    const current = row.location_id;
    const stillValid = locs.some((l) => String(l.id) === String(current));
    const nextLocId = stillValid ? current : String(locs[0]?.id || "");
    onUpdate(row.id, { warehouse_id: val, location_id: nextLocId });
  };

  const unitLabel =
    row.length_unit === "um" ? "µm" : row.length_unit === "m" ? "m" : "";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-gray-800">
      {/* Mobile: Card Layout */}
      <div className="block md:hidden">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex-1">
            <div className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {row.display_label}
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onClone(row.id)}
            >
              <span title="Klonla" aria-hidden>
                +
              </span>
              <span className="sr-only">Klonla</span>
            </Button>
            <Button
              variant="outline"
              className="h-8 w-8 p-0"
              onClick={() => onDelete(row.id)}
            >
              <span title="Sil" aria-hidden>
                -
              </span>
              <span className="sr-only">Sil</span>
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label>Adet</Label>
              <Input
                type="number"
                min="1"
                value={String(row.qty)}
                onChange={(e) =>
                  onUpdate(row.id, {
                    qty: Math.max(1, parseInt(e.target.value || "1", 10)),
                  })
                }
              />
            </div>
            <div>
              <Label>En</Label>
              <Input
                type="number"
                min="0"
                value={row.width || ""}
                onChange={(e) => onUpdate(row.id, { width: e.target.value })}
                placeholder={unitLabel || "Opsiyonel"}
              />
            </div>
            <div>
              <Label>Boy</Label>
              <Input
                type="number"
                min="0"
                value={row.height || ""}
                onChange={(e) => onUpdate(row.id, { height: e.target.value })}
                placeholder={unitLabel || "Opsiyonel"}
              />
            </div>
          </div>

          <div>
            <Label>Depo</Label>
            <Select
              options={warehouseOptions}
              value={row.warehouse_id || ""}
              placeholder="Seçiniz"
              onChange={handleWarehouseChange}
            />
          </div>

          <div>
            <Label>Lokasyon</Label>
            <Select
              options={locationOptions}
              value={row.location_id || ""}
              placeholder="Seçiniz"
              onChange={(val: string) =>
                onUpdate(row.id, { location_id: val })
              }
            />
          </div>

          <div>
            <Label>Fatura No</Label>
            <Input
              type="text"
              value={row.invoice_no || ""}
              onChange={(e) =>
                onUpdate(row.id, { invoice_no: e.target.value })
              }
              placeholder="Opsiyonel"
            />
          </div>
        </div>
      </div>

      {/* Desktop: Grid Layout */}
      <div className="hidden md:block">
        {/* Data Row - Everything aligned with items-center */}
        <div className="grid grid-cols-[3.5fr_minmax(100px,0.6fr)_minmax(96px,0.55fr)_minmax(96px,0.55fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(90px,0.4fr)] items-center gap-4 px-4">
          {/* Display Label */}
          <div
            className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate"
            title={row.display_label}
          >
            {row.display_label}
          </div>

          {/* Quantity */}
          <Input
            type="number"
            min="1"
            className="w-full"
            value={String(row.qty)}
            onChange={(e) =>
              onUpdate(row.id, {
                qty: Math.max(1, parseInt(e.target.value || "1", 10)),
              })
            }
          />

          {/* Width */}
          <Input
            type="number"
            min="0"
            className="w-full"
            value={row.width || ""}
            onChange={(e) => onUpdate(row.id, { width: e.target.value })}
            placeholder={unitLabel || "Opsiyonel"}
          />

          {/* Height */}
          <Input
            type="number"
            min="0"
            className="w-full"
            value={row.height || ""}
            onChange={(e) => onUpdate(row.id, { height: e.target.value })}
            placeholder={unitLabel || "Opsiyonel"}
          />

          {/* Warehouse */}
          <Select
            options={warehouseOptions}
            value={row.warehouse_id || ""}
            placeholder="Seçiniz"
            onChange={handleWarehouseChange}
          />

          {/* Location */}
          <Select
            options={locationOptions}
            value={row.location_id || ""}
            placeholder="Seçiniz"
            onChange={(val: string) => onUpdate(row.id, { location_id: val })}
          />

          {/* Invoice */}
          <Input
            type="text"
            value={row.invoice_no || ""}
            onChange={(e) => onUpdate(row.id, { invoice_no: e.target.value })}
            placeholder="Opsiyonel"
          />

          {/* Actions */}
          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => onClone(row.id)}
            >
              <span title="Klonla" aria-hidden>
                +
              </span>
              <span className="sr-only">Klonla</span>
            </Button>

            <Button
              variant="outline"
              className="h-10 w-10 p-0"
              onClick={() => onDelete(row.id)}
            >
              <span title="Sil" aria-hidden>
                -
              </span>
              <span className="sr-only">Sil</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============= MAIN COMPONENT ============= */
export default function StockEntryPage() {
  const location = useLocation();
  const preset = (location.state || {}) as {
    categoryName?: string;
    typeId?: string;
    masterId?: string;
  };

  // Lookups
  const [categories, setCategories] = useState<ProductType[]>([]);
  const [types, setTypes] = useState<CarrierType[]>([]);
  const [mastersRaw, setMastersRaw] = useState<Master[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<SimpleLookup[]>([]);
  const [locationsByWarehouse, setLocationsByWarehouse] = useState<
    Record<number, Location[]>
  >({});

  // Selections
  const [categoryName, setCategoryName] = useState("");
  const [typeId, setTypeId] = useState("");
  const [selectedMasterIds, setSelectedMasterIds] = useState<string[]>([]);
  const [masterSearch, setMasterSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [supplierFilterId, setSupplierFilterId] = useState("");

  // Rows & Global Settings
  const [rows, setRows] = useState<Row[]>([]);
  const [globalSettings, setGlobalSettings] = useState<GlobalSettings>({
    invoice: "",
    warehouse: "",
    location: "",
  });

  // UI State
  const [uiAlert, setUiAlert] = useState<AlertState | null>(null);
  const rowsSectionRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);

  // Initial data load
  useEffect(() => {
    Promise.all([
      api.get("/lookups/product-types"),
      api.get("/lookups/warehouses"),
      api.get("/lookups/suppliers"),
      api.get("/masters"),
    ]).then(([categoriesRes, warehousesRes, suppliersRes, mastersRes]) => {
      setCategories(categoriesRes.data || []);
      setWarehouses(warehousesRes.data || []);
      setSuppliers(suppliersRes.data || []);
      setMastersRaw(mastersRes.data || []);
    });
  }, []);

  // Apply preset
  useEffect(() => {
    if (preset.categoryName) {
      setCategoryName(preset.categoryName);
    }
  }, [preset.categoryName]);

  // Load types and masters when category changes
  useEffect(() => {
    setTypeId("");
    const category = categories.find((c) => c.name === categoryName);

    if (!category) {
      setTypes([]);
      api.get("/masters").then((r) => setMastersRaw(r.data || []));
      return;
    }

    Promise.all([
      api.get(`/lookups/carrier-types?productTypeId=${category.id}`),
      api.get(`/masters?productTypeId=${category.id}`),
    ]).then(([typesRes, mastersRes]) => {
      setTypes(typesRes.data || []);
      setMastersRaw(mastersRes.data || []);
    });
  }, [categoryName, categories]);

  // Load masters when type changes
  useEffect(() => {
    const category = categories.find((c) => c.name === categoryName);

    if (!typeId) {
      const endpoint = category
        ? `/masters?productTypeId=${category.id}`
        : "/masters";
      api.get(endpoint).then((r) => setMastersRaw(r.data || []));
      return;
    }

    if (category) {
      api
        .get(`/masters?productTypeId=${category.id}&carrierTypeId=${typeId}`)
        .then((r) => setMastersRaw(r.data || []))
        .catch(() => {
          setMastersRaw((prev) =>
            prev.filter(
              (m) =>
                (m.carrier_type_id &&
                  Number(m.carrier_type_id) === Number(typeId)) ||
                !m.carrier_type_id
            )
          );
        });
    }
  }, [typeId, categoryName, categories, types]);

  // Apply preset master
  useEffect(() => {
    if (!preset.masterId) return;
    const exists = mastersRaw.find(
      (m) => String(m.id) === String(preset.masterId)
    );
    if (exists) {
      setSelectedMasterIds((prev) =>
        Array.from(new Set([...prev, String(exists.id)]))
      );
    }
  }, [mastersRaw, preset.masterId]);

  // Computed values
  const filteredMasters = useMemo(() => {
    if (!typeId) return mastersRaw;
    const idNum = Number(typeId);
    return mastersRaw.filter(
      (m) =>
        (m.carrier_type_id && Number(m.carrier_type_id) === idNum) ||
        !m.carrier_type_id
    );
  }, [mastersRaw, typeId]);

  const filteredForPanel = useMemo(() => {
    const term = masterSearch.toLowerCase();

    const bySupplier = supplierFilterId
      ? filteredMasters.filter(
          (m) => m.supplier_id && String(m.supplier_id) === supplierFilterId
        )
      : filteredMasters;

    if (!term) return bySupplier;

    return bySupplier.filter((m) => {
      const label = (
        m.display_label ||
        `${m.bimeks_code ?? ""} - ${m.bimeks_product_name ?? ""}`
      )
        .toString()
        .toLowerCase();

      const name = (m.bimeks_product_name ?? "").toLowerCase();
      const supplier = (m.supplier_name ?? "").toLowerCase();
      const code = (m.bimeks_code ?? "").toLowerCase();

      return (
        label.includes(term) ||
        name.includes(term) ||
        supplier.includes(term) ||
        code.includes(term)
      );
    });
  }, [filteredMasters, masterSearch, supplierFilterId]);

  const warehouseOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...warehouses.map((w) => createSelectOption(w.id, w.name)),
    ],
    [warehouses]
  );

  const globalLocationOptions = useMemo(
    () => [
      EMPTY_SELECT_OPTION,
      ...(globalSettings.warehouse
        ? locationsByWarehouse[Number(globalSettings.warehouse)] || []
        : []
      ).map((l) => createSelectOption(l.id, l.name)),
    ],
    [globalSettings.warehouse, locationsByWarehouse]
  );

  const isStockSaveEnabled =
    rows.length > 0 &&
    rows.every((r) => Number(r.qty) >= 1 && r.warehouse_id && r.location_id);

  // Handlers
  const ensureLocations = useCallback(
    async (warehouseId: string | number): Promise<Location[]> => {
      const id = Number(warehouseId);
      if (!id) return [];

      if (locationsByWarehouse[id]) return locationsByWarehouse[id];

      const res = await api.get(`/lookups/locations?warehouseId=${id}`);
      const list: Location[] = res.data || [];
      setLocationsByWarehouse((prev) => ({ ...prev, [id]: list }));
      return list;
    },
    [locationsByWarehouse]
  );

  const showAlert = useCallback((alert: AlertState) => {
    setUiAlert(alert);
    setTimeout(() => {
      alertRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 0);
  }, []);

  const handleApplySelections = useCallback(() => {
    const currentMasterIds = new Set(rows.map((r) => String(r.master_id)));
    const toAdd = selectedMasterIds.filter((id) => !currentMasterIds.has(id));

    const newRows: Row[] = toAdd.map((id) => {
      const master = filteredMasters.find((m) => String(m.id) === id)!;

      // Sadece Bimeks kodu göster
      const display = master.bimeks_code || master.display_label || `#${master.id}`;

      return {
        id: uid(),
        master_id: master.id,
        display_label: display,
        qty: 1,
        width: "",
        height: "",
        warehouse_id: "",
        location_id: "",
        invoice_no: globalSettings.invoice || "",
        length_unit: master.length_unit,
      };
    });

    const mastersToKeep = new Set(selectedMasterIds);
    const rowsAfterRemoval = rows.filter((r) =>
      mastersToKeep.has(String(r.master_id))
    );

    const removedCount = rows.length - rowsAfterRemoval.length;
    if (removedCount > 0) {
      const ok = confirm(
        `${removedCount} satır kaldırılacak. Devam edilsin mi?`
      );
      if (!ok) return;
    }

    setRows([...rowsAfterRemoval, ...newRows]);
    setTimeout(() => {
      rowsSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }, [rows, selectedMasterIds, filteredMasters, globalSettings.invoice]);

  const updateRow = useCallback((id: string, updates: Partial<Row>) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
  }, []);

  const cloneRow = useCallback((rowId: string) => {
    setRows((prev) => {
      const idx = prev.findIndex((x) => x.id === rowId);
      if (idx === -1) return prev;

      const original = prev[idx];
      const copy: Row = { ...original, id: uid(), qty: 1 };

      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }, []);

  const deleteRow = useCallback((rowId: string) => {
    setRows((prev) => prev.filter((r) => r.id !== rowId));
  }, []);

  const applyGlobalsToAll = useCallback(async () => {
    let nextRows = [...rows];

    if (globalSettings.warehouse) {
      const locs = await ensureLocations(globalSettings.warehouse);
      const firstLocId =
        globalSettings.location || String(locs[0]?.id || "");

      nextRows = nextRows.map((r) => ({
        ...r,
        warehouse_id: globalSettings.warehouse,
        location_id: firstLocId,
      }));

      if (!globalSettings.location) {
        setGlobalSettings((prev) => ({ ...prev, location: firstLocId }));
      }
    }

    nextRows = nextRows.map((r) => ({
      ...r,
      invoice_no: globalSettings.invoice,
    }));

    setRows(nextRows);
  }, [rows, globalSettings, ensureLocations]);

  const handleSave = useCallback(async () => {
  try {
    if (!rows.length) {
      showAlert({
        variant: "warning",
        title: "Eksik bilgi",
        message: "Önce tanım seçip satır oluşturun.",
      });
      return;
    }

    // 🔴 En / boy zorunlu kontrolü
    const dimErrors: string[] = [];
    rows.forEach((r, idx) => {
      const w =
        r.width !== undefined && r.width !== null && r.width !== ""
          ? Number(r.width)
          : NaN;
      const h =
        r.height !== undefined && r.height !== null && r.height !== ""
          ? Number(r.height)
          : NaN;

      if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
        dimErrors.push(String(idx + 1)); // 1-based satır numarası
      }
    });

    if (dimErrors.length) {
      showAlert({
        variant: "warning",
        title: "En / boy eksik veya hatalı",
        message:
          "Şu satırlarda en ve boy zorunludur ve 0'dan büyük olmalıdır: " +
          dimErrors.join(", "),
      });
      return;
    }

    const payload: any[] = [];
    rows.forEach((r) => {
      const master = mastersRaw.find((m) => m.id === r.master_id);
      const unit = (master?.default_unit || "EA") as "EA" | "M" | "KG";

      const width =
        r.width !== undefined && r.width !== null && r.width !== ""
          ? Number(r.width)
          : null;

      const height =
        r.height !== undefined && r.height !== null && r.height !== ""
          ? Number(r.height)
          : null;

      for (let i = 0; i < Number(r.qty); i++) {
        payload.push({
          master_id: r.master_id,
          unit,
          quantity: 1,
          warehouse_id: Number(r.warehouse_id),
          location_id: Number(r.location_id),
          width,
          height,
          invoice_no: r.invoice_no?.trim() || null,
        });
      }
    });

      const res = await api.post("/components/bulk", payload);

      showAlert({
        variant: "success",
        title: "Stok kaydı tamamlandı",
        message: `${res?.data?.length ?? payload.length} kayıt eklendi.`,
      });

      setTimeout(() => {
        alertRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 0);

      setRows([]);
    } catch (err: any) {
      console.error("Stok kaydı hatası:", err);
      const { status, data } = err?.response || {};

      if (status === 400 && data?.errors?.length) {
        const msg = data.errors
          .map((e: any) => `• Satır ${e.index + 1} - ${e.field}: ${e.message}`)
          .join("\n");

        showAlert({
          variant: "error",
          title: "Validasyon hatası",
          message: msg,
        });
        return;
      }

      showAlert({
        variant: "error",
        title: "Beklenmeyen hata",
        message: "Stok kaydı sırasında bir sorun oluştu.",
      });
    }
  }, [rows, mastersRaw, showAlert]);

  const handleGlobalWarehouseChange = useCallback(
    async (val: string) => {
      setGlobalSettings((prev) => ({ ...prev, warehouse: val }));
      const locs = await ensureLocations(val);
      const firstLoc = String(locs[0]?.id || "");
      setGlobalSettings((prev) => ({ ...prev, location: firstLoc }));
    },
    [ensureLocations]
  );

  const categoryOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...categories.map((c) => createSelectOption(c.name, c.name)),
    ],
    [categories]
  );

  const supplierFilterOptions = useMemo(
    () => [
      createSelectOption("", "Tümü"),
      ...suppliers.map((s) => createSelectOption(s.id, s.name)),
    ],
    [suppliers]
  );

  return (
    <div className="space-y-6">
      <PageMeta
        title="Stok Girişi"
        description="Tanım seç + yeni tanım ekle + satırlardan stok girişi"
      />
      <PageBreadcrumb pageTitle="Stok Girişi" />

      {/* Card #1: Master Selection */}
      <ComponentCard title="Tanım Seçimi">
        <details
          open={createOpen}
          onToggle={(e) =>
            setCreateOpen((e.target as HTMLDetailsElement).open)
          }
          className="rounded-lg border border-gray-200 p-4 dark:border-gray-700"
        >
          <summary className="cursor-pointer select-none text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-gray-900 dark:hover:text-white">
            Yeni Tanım Ekle
          </summary>

          <div className="mt-4">
            <MasterInlineForm
              onSaved={async (m) => {
                setSelectedMasterIds((prev) =>
                  Array.from(new Set([...prev, String(m.id)]))
                );
                
                // Yeni kaydedilen master'ın tam bilgilerini çek
                try {
                  const res = await api.get(`/masters/${m.id}`);
                  const fullMaster: Master = res.data;
                  
                  setMastersRaw((prev) => [fullMaster, ...prev]);
                } catch (err) {
                  console.error("Master bilgileri çekilemedi:", err);
                  // Fallback: en azından ID ve display_label ile ekle
                  setMastersRaw((prev) => [
                    {
                      id: m.id,
                      display_label: m.display_label || `#${m.id}`,
                    } as Master,
                    ...prev,
                  ]);
                }
              }}
              onCancel={() => setCreateOpen(false)}
            />
          </div>
        </details>

        <div className="mt-4">
          <Label>Tanım Seçimi (çoklu)</Label>
          <div className="mt-2 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="border-b border-gray-100 bg-gray-50 px-3 py-3 text-xs dark:border-gray-800 dark:bg-gray-900/40">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1.2fr)_minmax(0,1.6fr)]">
                <div>
                  <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Ürün Türü
                  </Label>
                  <Select
                    options={categoryOptions}
                    value={categoryName}
                    placeholder="Tümü"
                    onChange={setCategoryName}
                  />
                </div>

                <div>
                  <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    Tedarikçi
                  </Label>
                  <Select
                    options={supplierFilterOptions}
                    value={supplierFilterId}
                    placeholder="Tümü"
                    onChange={setSupplierFilterId}
                  />
                </div>

                <div className="flex flex-col gap-2 md:flex-row md:items-end">
                  <div className="flex-1">
                    <Label className="mb-1 block text-[11px] uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      Arama
                    </Label>
                    <Input
                      type="text"
                      placeholder="Bimeks kodu veya ad ile ara..."
                      value={masterSearch}
                      onChange={(e) => setMasterSearch(e.target.value)}
                    />
                  </div>
                  <Button
                    variant="outline"
                    className="mt-1 h-10 px-4 text-xs font-medium md:mt-0 md:h-10 md:self-end"
                    onClick={() => {
                      setMasterSearch("");
                      setSupplierFilterId("");
                      setCategoryName("");
                      setSelectedMasterIds([]);
                    }}
                  >
                    Seçimleri Temizle
                  </Button>
                </div>
              </div>
            </div>

            <div className="max-h-64 overflow-auto pr-0">
              <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-3 text-[11px] font-semibold uppercase tracking-wide text-gray-600 dark:border-gray-800 dark:bg-gray-900/60 dark:text-gray-400">
                <div className="text-left">Bimeks Ürün Tanımı</div>
                <div className="text-left">Bimeks Kodu</div>
                <div className="text-left">Ürün Türü</div>
                <div className="text-left">Tedarikçi</div>
                <div className="text-left">Tedarikçi Ürün Kodu</div>
              </div>

              {filteredForPanel.length === 0 ? (
                <div className="px-4 py-4 text-sm text-gray-500 dark:text-gray-400">
                  Kayıt bulunamadı.
                </div>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {filteredForPanel.map((m) => {
                    const idStr = String(m.id);
                    const checked = selectedMasterIds.includes(idStr);

                    const displayName =
                      m.bimeks_product_name || m.display_label || `#${m.id}`;

                    const productTypeName =
                      categories.find((c) => c.id === m.product_type_id)
                        ?.name || "—";

                    return (
                      <li key={idStr}>
                        <label className="grid cursor-pointer grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-3 px-4 py-3 text-xs hover:bg-gray-50 dark:hover:bg-gray-800/60 md:text-sm">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={checked}
                              onChange={(e) => {
                                const on = e.target.checked;
                                setSelectedMasterIds((prev) =>
                                  on
                                    ? Array.from(new Set([...prev, idStr]))
                                    : prev.filter((x) => x !== idStr)
                                );
                              }}
                            />
                            <span className="truncate text-gray-800 dark:text-gray-100">
                              {displayName}
                            </span>
                          </div>

                          <div className="truncate font-mono text-xs text-gray-700 dark:text-gray-200">
                            {m.bimeks_code || "—"}
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {productTypeName}
                          </div>

                          <div className="truncate text-gray-600 dark:text-gray-300">
                            {m.supplier_name || "—"}
                          </div>

                          <div className="truncate font-mono text-xs text-gray-700 dark:text-gray-200">
                            {m.supplier_product_code || "—"}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          <div className="mt-3 flex justify-end">
            <Button variant="primary" onClick={handleApplySelections}>
              Seçilenleri Listele
            </Button>
          </div>
        </div>
      </ComponentCard>

      {/* Card #2: Stock Entry Rows */}
      {rows.length > 0 && (
        <ComponentCard title="Stok Girişi">
          <div ref={rowsSectionRef} />

          <div className="grid grid-cols-1 items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
            <div>
              <Label>Fatura No</Label>
              <Input
                type="text"
                value={globalSettings.invoice}
                onChange={(e) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    invoice: e.target.value,
                  }))
                }
                placeholder="Opsiyonel"
              />
            </div>
            <div>
              <Label>Varsayılan Depo</Label>
              <Select
                options={warehouseOptions}
                value={globalSettings.warehouse}
                placeholder="Seçiniz"
                onChange={handleGlobalWarehouseChange}
              />
            </div>
            <div>
              <Label>Varsayılan Lokasyon</Label>
              <Select
                options={globalLocationOptions}
                value={globalSettings.location}
                placeholder="Seçiniz"
                onChange={(val: string) =>
                  setGlobalSettings((prev) => ({
                    ...prev,
                    location: val,
                  }))
                }
              />
            </div>
            <div className="flex justify-end md:justify-start">
              <Button
                variant="outline"
                className="w-full md:w-auto"
                onClick={applyGlobalsToAll}
              >
                Tümüne Uygula
              </Button>
            </div>
          </div>

          <div className="my-4 h-px w-full bg-gray-200 dark:bg-gray-700" />

          {/* Header Row - Desktop Only - Once */}
          <div className="hidden md:grid md:grid-cols-[3.5fr_minmax(100px,0.6fr)_minmax(96px,0.55fr)_minmax(96px,0.55fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(140px,0.8fr)_minmax(90px,0.4fr)] md:gap-4 mb-3 px-4">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Ürün</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Adet</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">En</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Boy</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Depo</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Lokasyon</div>
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300">Fatura No</div>
            <div></div>
          </div>

          <div className="space-y-4">
            {rows.map((row) => (
              <StockRow
                key={row.id}
                row={row}
                warehouseOptions={warehouseOptions}
                locationsByWarehouse={locationsByWarehouse}
                onUpdate={updateRow}
                onClone={cloneRow}
                onDelete={deleteRow}
                ensureLocations={ensureLocations}
              />
            ))}
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={!isStockSaveEnabled}
            >
              Stok Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}

      <div ref={alertRef} className="mt-4">
        {uiAlert && (
          <Alert
            variant={uiAlert.variant}
            title={uiAlert.title}
            message={uiAlert.message}
          />
        )}
      </div>
    </div>
  );
}