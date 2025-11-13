// src/pages/Details/MasterDetailPage.tsx
import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../services/api";

import PageMeta from "../../components/common/PageMeta";
import PageBreadcrumb from "../../components/common/PageBreadCrumb";
import ComponentCard from "../../components/common/ComponentCard";
import Label from "../../components/form/Label";
import Input from "../../components/form/input/InputField";
import Button from "../../components/ui/button/Button";

/* ---------- Şema tipleri ---------- */
type FieldDef = {
  key: string;
  label: string;
  kind: "text" | "number" | "select";
  required?: boolean;
  unitSuffix?: string;
  options?: { value: string | number; label: string }[];
};
type Schema = {
  version: string | number;
  baseFields: FieldDef[];
  categoryFields: Record<string, FieldDef[]>;
  categoryMapById?: Record<string | number, string>;
  categoryMapByName?: Record<string, string>;
};

/* ---------- Master view (read-only) ---------- */
type MasterView = Record<string, any> & {
  id: number;
  display_label?: string | null;
  category_name?: string | null;
  type_name?: string | null;
  supplier_name?: string | null;
  bimeks_code?: string | null;
};

export default function MasterDetailPage() {
  const { id: rawId } = useParams();
  const navigate = useNavigate();
  const id = Number(rawId || 0);

  const [loading, setLoading] = useState(true);
  const [schema, setSchema] = useState<Schema | null>(null);

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
        const [schemaRes, masterRes] = await Promise.all([
          api.get("/lookups/master-field-schema"),
          api.get(`/masters/${id}`),
        ]);
        setSchema(schemaRes.data || null);
        const mv = masterRes.data || null;
        setMasterView(mv);
        setBimeksCode(mv?.bimeks_code || "");
      } catch (e) {
        console.error("master detail load error:", e);
        alert("Detay yüklenemedi.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  /* ------ Şemaya göre gösterilecek alanları hazırla ------ */
  const masterCategoryKey = useMemo(() => {
    if (!schema || !masterView?.category_name) return null;
    const map = schema.categoryMapByName || {};
    return map[String(masterView.category_name).toUpperCase()] || null;
  }, [schema, masterView?.category_name]);

  const masterFieldsToShow: FieldDef[] = useMemo(() => {
    if (!schema) return [];
    const base = schema.baseFields || [];
    const cat = masterCategoryKey ? schema.categoryFields?.[masterCategoryKey] || [] : [];
    return [...base, ...cat];
  }, [schema, masterCategoryKey]);

  /* ------ Kaydet (sadece Bimeks Kodu düzenlenebilir) ------ */
  const handleSave = async () => {
    try {
      await api.put(`/masters/${id}`, { bimeks_code: bimeksCode || null });
      alert("Bimeks Kodu güncellendi.");
      setMasterView((p) => (p ? { ...p, bimeks_code: bimeksCode || null } : p));
    } catch (err: any) {
      console.error("save error:", err?.response?.data || err);
      alert("Kaydetme hatası.");
    }
  };

  return (
    <div className="space-y-6">
      <PageMeta title="Master Detay" description="Master kayıt detayları" />
      <PageBreadcrumb pageTitle="Master Detay" />

      {loading ? (
        <ComponentCard title="Yükleniyor…">
          <div className="py-6 text-sm text-gray-500">Lütfen bekleyin…</div>
        </ComponentCard>
      ) : (
        <ComponentCard title="Tanım (Master)">
          {/* Başlık satırı */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Display Name</Label>
              <Input value={masterView?.display_label ?? ""} disabled />
            </div>
            <div>
              <Label>Bimeks Kodu</Label>
              <Input
                value={bimeksCode}
                onChange={(e) => setBimeksCode(e.target.value)}
                placeholder="Bimeks Kodu"
              />
            </div>
          </div>

          {/* Şemaya göre alanlar (read-only) */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            {masterFieldsToShow.map((f) => {
              // select’lerin label karşılığı response’ta varsa onu göster
              let raw: any = masterView?.[f.key];
              if (f.key === "type_id" && masterView?.type_name) raw = masterView.type_name;
              if (f.key === "supplier_id" && masterView?.supplier_name) raw = masterView.supplier_name;

              const value = raw === null || raw === undefined ? "" : String(raw);
              const suffix = f.unitSuffix ? ` ${f.unitSuffix}` : "";
              return (
                <div key={f.key}>
                  <Label>{f.label}</Label>
                  <Input value={`${value}${value ? suffix : ""}`} disabled />
                </div>
              );
            })}
          </div>

          <div className="mt-3 text-xs text-gray-500 dark:text-gray-400">
            Master yalnızca görüntülenebilir, düzenlenemez.
          </div>

          <div className="mt-6 flex justify-end">
            <Button
              variant="primary"
              onClick={handleSave}
              disabled={bimeksCode === (masterView?.bimeks_code || "")}
            >
              Kaydet
            </Button>
          </div>
        </ComponentCard>
      )}
    </div>
  );
}
