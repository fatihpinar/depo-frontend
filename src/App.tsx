// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

import MasterDetailPage from "./pages/Details/MasterDetail";
import ProductDetailPage from "./pages/Details/ProductDetail";
import ComponentDetailPage from "./pages/Details/ComponentDetail";
import LegacyDetailsRedirect from "./pages/LegacyDetailsRedirect";

import StockEntry from "./pages/Stocks/StockEntry";
import StockList from "./pages/Stocks/StockList";
import MasterList from "./pages/Masters/MasterList";
import ProductAssemble from "./pages/Stocks/ProductAssemble";
import ProductsList from "./pages/Stocks/ProductsList";
import InventoryListPage from "./pages/Inventory/InventoryList";
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

            <Route element={<RequirePermission anyOf={["stock.entry.create"]} />}>
              <Route path="/stock-entry" element={<StockEntry />} />
            </Route>

            <Route element={<RequirePermission anyOf={["product.assemble"]} />}>
              <Route path="/product-assemble" element={<ProductAssemble />} />
            </Route>

            <Route element={<RequirePermission anyOf={["masters.read"]} />}>
              <Route path="/masters" element={<MasterList />} />
            </Route>

            <Route element={<RequirePermission anyOf={["components.read"]} />}>
              <Route path="/stocks" element={<StockList />} />
            </Route>

            <Route element={<RequirePermission anyOf={["inventory.read"]} />}>
              <Route path="/productsList" element={<ProductsList />} />
              <Route path="/InventoryList" element={<InventoryListPage />} />
            </Route>

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
