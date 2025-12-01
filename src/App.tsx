// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./components/common/OtherPage/NotFound";
import UserProfiles from "./pages/Profile/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

// Details
import MasterDetailPage from "./pages/Details/MasterDetail";
import ProductDetailPage from "./pages/Details/ProductDetail";
import ComponentDetailPage from "./pages/Details/ComponentDetail";
import LegacyDetailsRedirect from "./components/common/LegacyDetailsRedirect";

// ✅ INVENTORY PAGES (yeni klasör & isimler)
import StockEntryPage from "./pages/Inventory/StockEntryPage";
import MasterListPage from "./pages/Inventory/MasterListPage";
import ComponentListPage from "./pages/Inventory/ComponentListPage";
import ProductListPage from "./pages/Inventory/ProductListPage";
import StockExitPage from "./pages/Inventory/StockExitPage";
import InventoryListPage from "./pages/Inventory/InventoryListPage";

import StockReceiptApprovalPage from "./pages/Approvals/StockReceiptApprovalPage";
import ScreenprintCompletionPage from "./pages/Approvals/ScreenprintCompletionPage";
import ProductionCompletionPage from "./pages/Approvals/ProductionCompletionPage";

import RequireAuth from "./components/auth/RequireAuth";
import RequirePermission from "./components/auth/RequirePermission";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        {/* --- Public routes --- */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* --- Protected area --- */}
        <Route element={<RequireAuth />}>
          <Route element={<AppLayout />}>
            <Route index path="/" element={<Home />} />

                        {/* Stok giriş */}
            <Route element={<RequirePermission anyOf={["stock.entry.create"]} />}>
              <Route path="/inventory/stock-entry" element={<StockEntryPage />} />
            </Route>

            {/* Component çıkışı / ürün oluşturma */}
            <Route element={<RequirePermission anyOf={["product.assemble"]} />}>
              <Route path="/inventory/stock-exit" element={<StockExitPage />} />
            </Route>

            {/* Tanım listesi (masters) */}
            <Route element={<RequirePermission anyOf={["masters.read"]} />}>
              <Route path="/inventory/masters" element={<MasterListPage />} />
            </Route>

            {/* Komponent listesi */}
            <Route element={<RequirePermission anyOf={["components.read"]} />}>
              <Route path="/inventory/components" element={<ComponentListPage />} />
            </Route>

            {/* Ürün listesi */}
            <Route element={<RequirePermission anyOf={["products.read"]} />}>
              <Route path="/inventory/products" element={<ProductListPage />} />
            </Route>

            {/* Envanter listesi (toplam stok görünümü) */}
            <Route element={<RequirePermission anyOf={["inventory.read"]} />}>
              <Route path="/inventory/list" element={<InventoryListPage />} />
            </Route>

            {/* Approval sayfaları */}
            <Route element={<RequirePermission anyOf={["receipts.stock.approve"]} />}>
              <Route path="/stock-receipts" element={<StockReceiptApprovalPage />} />
            </Route>

            <Route element={<RequirePermission anyOf={["receipts.production.approve"]} />}>
              <Route path="/production-receipts" element={<ProductionCompletionPage />} />
            </Route>

            <Route element={<RequirePermission anyOf={["receipts.screenprint.approve"]} />}>
              <Route path="/screenprint-receipts" element={<ScreenprintCompletionPage />} />
            </Route>

            {/* Detay rotaları */}
            <Route path="/details/master/:id" element={<MasterDetailPage />} />
            <Route path="/details/product/:id" element={<ProductDetailPage />} />
            <Route path="/details/component/:id" element={<ComponentDetailPage />} />
            <Route path="/details/:kind/:id" element={<LegacyDetailsRedirect />} />

            {/* Profil */}
            <Route path="/profile" element={<UserProfiles />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
