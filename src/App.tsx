// src/App.tsx
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import SignIn from "./pages/AuthPages/SignIn";
import SignUp from "./pages/AuthPages/SignUp";
import NotFound from "./pages/OtherPage/NotFound";
import UserProfiles from "./pages/UserProfiles";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import Home from "./pages/Dashboard/Home";

// detayların yeni halleri
import MasterDetailPage from "./pages/Details/MasterDetail";
import ProductDetailPage from "./pages/Details/ProductDetail";
import ComponentDetailPage from "./pages/Details/ComponentDetail";
import LegacyDetailsRedirect from "./pages/LegacyDetailsRedirect";

// Bizim diğer sayfalar
import StockEntry from "./pages/Stocks/StockEntry";
import StockList from "./pages/Stocks/StockList";
import MasterList from "./pages/Masters/MasterList";
import ProductAssemble from "./pages/Stocks/ProductAssemble";
import ProductsList from "./pages/Stocks/ProductsList";
import InventoryListPage from "./pages/Inventory/InventoryList";
import StockReceiptApprovalPage from "./pages/Approvals/StockReceiptApprovalPage";
import ScreenprintCompletionPage from "./pages/Approvals/ScreenprintCompletionPage";
import ProductionCompletionPage from "./pages/Approvals/ProductionCompletionPage";

export default function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index path="/" element={<Home />} />

          {/* Bizim yeni sayfalar */}
          <Route path="/stock-entry" element={<StockEntry />} />
          <Route path="/product-assemble" element={<ProductAssemble />} />
          <Route path="/masters" element={<MasterList />} />
          <Route path="/stocks" element={<StockList />} />
          <Route path="/productsList" element={<ProductsList />} />
          <Route path="/InventoryList" element={<InventoryListPage />} />
          <Route path="/stock-receipts" element={<StockReceiptApprovalPage />} />
          <Route path="/production-receipts" element={<ProductionCompletionPage />} />
          <Route path="/screenprint-receipts" element={<ScreenprintCompletionPage />} />

          {/* Detay – yeni ayrık rotalar */}
          <Route path="/details/master/:id" element={<MasterDetailPage />} />
          <Route path="/details/product/:id" element={<ProductDetailPage />} />
          <Route path="/details/component/:id" element={<ComponentDetailPage />} />

          {/* Eski pattern için geriye dönük yönlendirme */}
          <Route path="/details/:kind/:id" element={<LegacyDetailsRedirect />} />

          {/* Profil */}
          <Route path="/profile" element={<UserProfiles />} />
        </Route>

        {/* Auth */}
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

        {/* 404 */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}
