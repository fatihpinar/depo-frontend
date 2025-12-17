import EcommerceMetrics from "../../components/ecommerce/EcommerceMetrics";
import MonthlySalesChart from "../../components/ecommerce/MonthlySalesChart";
import StatisticsChart from "../../components/ecommerce/StatisticsChart";
import RecentOrders from "../../components/ecommerce/RecentOrders";
import PageMeta from "../../components/common/PageMeta";

export default function Home() {
  return (
    <>
      <PageMeta
        title="Dashboard"
        description="Depo Stok Yönetimi Dashboard"
      />

      <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* KPI cards (şimdilik EcommerceMetrics, sonra WMS KPI'ya çevireceğiz) */}
        <div className="col-span-12">
          <EcommerceMetrics />
        </div>

        {/* Sol: Stok Hareketleri (şimdilik MonthlySalesChart) */}
        <div className="col-span-12 xl:col-span-8">
          <div className="rounded-2xl border bg-white p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Stok Hareketleri</h2>
              <p className="text-sm text-gray-500">
                (Şimdilik theme chart) Filtrelere göre giriş/çıkış/transfer
              </p>
            </div>

            <MonthlySalesChart />
          </div>
        </div>

        {/* Sağ: Durum Dağılımı (şimdilik boş placeholder card) */}
        <div className="col-span-12 xl:col-span-4">
          <div className="rounded-2xl border bg-white p-4 md:p-6 h-full">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Stok Durum Dağılımı</h2>
              <p className="text-sm text-gray-500">
                In Stock / Pending / Production / Used
              </p>
            </div>

            {/* Placeholder: sonra donut/pie ekleyeceğiz */}
            <div className="flex h-[260px] items-center justify-center rounded-xl bg-gray-50 text-sm text-gray-500">
              Grafik eklenecek
            </div>
          </div>
        </div>

        {/* Trend (şimdilik StatisticsChart) */}
        <div className="col-span-12">
          <div className="rounded-2xl border bg-white p-4 md:p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Operasyon Trendi</h2>
                <p className="text-sm text-gray-500">
                  Günlük hareket sayısı / bekleyen işlemler trendi
                </p>
              </div>

              <div className="hidden md:block text-sm text-gray-500">
                Son 30 gün
              </div>
            </div>

            <StatisticsChart />
          </div>
        </div>

        {/* Son hareketler (şimdilik RecentOrders) */}
        <div className="col-span-12">
          <div className="rounded-2xl border bg-white p-4 md:p-6">
            <div className="mb-4">
              <h2 className="text-lg font-semibold">Son Hareketler</h2>
              <p className="text-sm text-gray-500">
                (Şimdilik theme table) En son yapılan stok işlemleri
              </p>
            </div>

            <RecentOrders />
          </div>
        </div>
      </div>
    </>
  );
}
