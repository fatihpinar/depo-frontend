// src/pages/Details/MasterDetailPage.tsx
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

/* ---------- Master view (JOIN edilmiş) ---------- */
type MasterView = {
  id: number;

  bimeks_product_name?: string | null;
  bimeks_code?: string | null;

  // eski ama dursun
  display_label?: string | null;

  supplier_product_code?: string | null;
  supplier_lot_no?: string | null;

  thickness?: number | null;
  thickness_unit?: string | null;   // ✅ YENİ
  stock_unit?: string | null;       // ✅ YENİ

  carrier_density?: number | null;

  // eskiden vardı, kalsın
  length_unit?: string | null;

  product_type_name?: string | null;
  carrier_type_name?: string | null;
  supplier_name?: string | null;
  carrier_color_name?: string | null;
  liner_color_name?: string | null;
  liner_type_name?: string | null;
  adhesive_type_name?: string | null;

  [key: string]: any;
};

function stockUnitLabelTR(v?: string | null) {
  const s = (v || "").toLowerCase();
  if (s === "area") return "Alan";
  if (s === "weight") return "Ağırlık";
  if (s === "length") return "Uzunluk";
  if (s === "unit") return "Adet";
  return v ? String(v) : "";
}

function thicknessUnitLabelTR(v?: string | null) {
  const s = (v || "").toLowerCase();
  if (s === "um") return "µm";
  if (s === "m") return "m";
  return v ? String(v) : "";
}

export default function MasterDetailPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const id = Number(rawId || 0);

  const [masterName, setMasterName] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [masterView, setMasterView] = useState<MasterView | null>(null);
  const [bimeksCode, setBimeksCode] = useState<string>("");

  useEffect(() => {
    if (!id) {
      navigate("/404");
      return;
    }

    (async () => {
      try {
        setLoading(true);
        const { data } = await api.get(`/masters/${id}`);
        const mv: MasterView = data || null;
        setMasterView(mv);
        setBimeksCode(mv?.bimeks_code || "");
        setMasterName(mv?.bimeks_product_name || "");
      } catch (e) {
        console.error("master detail load error:", e);
        alert("Detay yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  /* ------ Kaydet (Sadece: bimeks_code + bimeks_product_name) ------ */
  const handleSave = async () => {
    try {
      const payload = {
        bimeks_code: bimeksCode || null,
        bimeks_product_name: masterName?.trim() || null,
      };

      const { data } = await api.put(`/masters/${id}/full`, payload);
      setMasterView(data);
      setBimeksCode(data?.bimeks_code || "");
      setMasterName(data?.bimeks_product_name || "");
      alert("Master tanımı ve Bimeks Kodu güncellendi.");
    } catch (err: any) {
      console.error("master save error:", err?.response?.data || err);
      alert(err?.response?.data?.message || "Kaydetme hatası.");
    }
  };

  const m = masterView;

  const fmtNum = (v?: number | null, suffix?: string) =>
    v === null || v === undefined || Number.isNaN(Number(v))
      ? ""
      : `${v} ${suffix ?? ""}`.trim();

  return (
    <div className="space-y-6">
      <PageMeta title="Master Detay" description="Master kayıt detayları" />
      <PageBreadcrumb pageTitle="Master Detay" />

      {loading ? (
        <ComponentCard title="Yükleniyor…">
          <div className="py-6 text-sm text-gray-500">Lütfen bekleyin…</div>
        </ComponentCard>
      ) : !m ? (
        <ComponentCard title="Bulunamadı">
          <div className="py-6 text-sm text-gray-500">
            Kayıt bulunamadı veya silinmiş olabilir.
          </div>
        </ComponentCard>
      ) : (
        <ComponentCard title="Tanım (Master)">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* 1. satır (editable) */}
            <div>
              <Label>Tanım İsmi</Label>
              <Input
                value={masterName}
                onChange={(e) => setMasterName(e.target.value)}
                placeholder="Bimeks ürün tanımı"
              />
            </div>
            <div>
              <Label>Bimeks Kodu</Label>
              <Input
                value={bimeksCode}
                onChange={(e) => setBimeksCode(e.target.value)}
                placeholder="Bimeks Kodu"
              />
            </div>

            {/* 2. satır */}
            <div>
              <Label>Ürün Türü</Label>
              <Input value={m.product_type_name ?? ""} disabled />
            </div>
            <div>
              <Label>Taşıyıcı Türü</Label>
              <Input value={m.carrier_type_name ?? ""} disabled />
            </div>

            {/* 3. satır */}
            <div>
              <Label>Tedarikçi</Label>
              <Input value={m.supplier_name ?? ""} disabled />
            </div>
            <div>
              <Label>Tedarikçi Ürün Kodu</Label>
              <Input value={m.supplier_product_code ?? ""} disabled />
            </div>

            {/* ✅ 4. satır (YENİ: stok_unit + thickness_unit) */}
            <div>
              <Label>Stok Ölçü Birimi</Label>
              <Input value={stockUnitLabelTR(m.stock_unit)} disabled />
            </div>
            <div>
              <Label>Kalınlık Birimi</Label>
              <Input value={thicknessUnitLabelTR(m.thickness_unit)} disabled />
            </div>

            {/* 5. satır */}
            <div>
              <Label>Kalınlık</Label>
              <Input
                value={
                  m.thickness === null || m.thickness === undefined
                    ? ""
                    : `${m.thickness} ${thicknessUnitLabelTR(m.thickness_unit)}`.trim()
                }
                disabled
              />
            </div>

            <div>
              <Label>Taşıyıcı Yoğunluğu</Label>
              <Input value={fmtNum(m.carrier_density, "kg/m³")} disabled />
            </div>

            {/* 6. satır */}
            <div>
              <Label>Taşıyıcı Rengi</Label>
              <Input value={m.carrier_color_name ?? ""} disabled />
            </div>
            <div>
              <Label>Liner Rengi</Label>
              <Input value={m.liner_color_name ?? ""} disabled />
            </div>

            {/* 7. satır */}
            <div>
              <Label>Liner Cinsi</Label>
              <Input value={m.liner_type_name ?? ""} disabled />
            </div>
            <div>
              <Label>Yapışkan Türü</Label>
              <Input value={m.adhesive_type_name ?? ""} disabled />
            </div>
          </div>

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Master alanları yalnızca görüntülenebilir; sadece <b>Bimeks Ürün Tanımı</b> ve{" "}
            <b>Bimeks Kodu</b> güncellenebilir.
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={
                bimeksCode === (m.bimeks_code || "") &&
                masterName === (m.bimeks_product_name || "")
              }
            >
              Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}
    </div>
  );
}
