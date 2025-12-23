// src/components/header/AppHeader.tsx
// Mevcut hiçbir şeyi bozmayacak şekilde: sadece global arama + QR scanner.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSidebar } from "../context/SidebarContext";
import { ThemeToggleButton } from "../components/common/ThemeToggleButton";
import UserDropdown, { Me } from "../components/header/UserDropdown";
import api from "../services/api";
import { Search, QrCode, X, Menu } from "lucide-react";


/* Scanner */
import BarcodeScannerModal from "../components/scan/BarcodeScannerModal";

type ComponentHit = {
  id: number;
  barcode?: string | null;
  master?: { display_label?: string | null } | null;
  display_label?: string | null;
};

// Barkod normalize (TR locale gereksiz ama güvenli)
const normalizeBarcode = (v: any) =>
  String(v ?? "")
    .trim()
    .toLocaleUpperCase("tr-TR");

// Tanım normalize: uppercase YAPMIYORUZ (TR karakter bozmasın; ILIKE zaten case-insensitive)
const normalizeText = (v: any) => String(v ?? "").trim();

const isComponentBarcode = (v: string) => /^C\d{8}$/.test(normalizeBarcode(v));

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();
  const navigate = useNavigate();

  // /auth/me → kullanıcı bilgisi
  useEffect(() => {
    let mounted = true;
    api
      .get("/auth/me")
      .then((r) => {
        if (mounted) setMe(r.data as Me);
      })
      .catch(() => {
        if (mounted) setMe(null);
      });
    return () => {
      mounted = false;
    };
  }, []);

  const handleToggle = () => {
    if (window.innerWidth >= 1024) toggleSidebar();
    else toggleMobileSidebar();
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  /* =========================
     Global Search + Scanner
     ========================= */

  const [query, setQuery] = useState("");
  const [scanOpen, setScanOpen] = useState(false);

  // autocomplete
  const [suggestions, setSuggestions] = useState<ComponentHit[]>([]);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggestLoading, setSuggestLoading] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  // request race guard
  const suggestReqIdRef = useRef(0);

  const displayLabelOf = (c: ComponentHit) =>
    c.master?.display_label ?? c.display_label ?? "(Tanım Yok)";

  const openScanner = () => setScanOpen(true);
  const closeScanner = () => setScanOpen(false);

  // Barkodla komponent bul -> detaya git
  const goToComponentByBarcode = async (barcode: string) => {
    const code = normalizeBarcode(barcode);
    if (!code) return;

    const { data } = await api.get("/components/by-barcode", {
      params: { barcode: code },
    });

    const id = data?.id ?? data?.component?.id ?? null;
    if (!id) throw new Error("NOT_FOUND");

    setSuggestOpen(false);
    navigate(`/details/component/${id}`);
  };

  // Tanım ile komponent arama (autocomplete + Enter)
  const searchComponentsByText = async (text: string, limit = 8) => {
    const q = normalizeText(text);
    if (!q) return [];

    const { data } = await api.get("/components/search", {
      params: { q, limit },
    });

    const items: ComponentHit[] = data?.items ?? data ?? [];
    return Array.isArray(items) ? items : [];
  };

  // Enter / manuel arama
  const runSearch = async (raw?: string) => {
    const rawText = raw ?? query;
    const text = normalizeText(rawText);
    if (!text) return;

    try {
      setSuggestError(null);

      // Barkod formatıysa direkt detaya
      if (isComponentBarcode(text)) {
        await goToComponentByBarcode(text);
        return;
      }

      // Tanım araması:
      // - 1 sonuç: detaya git
      // - 0 veya >1: hiçbir yere gitme (sadece dropdown/suggestion mantığı kalsın)
      const items = await searchComponentsByText(text, 10);

      if (items.length === 1) {
        setSuggestOpen(false);
        navigate(`/details/component/${items[0].id}`);
        return;
      }

      // hiçbir yere gitme:
      setSuggestions(items);
      setSuggestOpen(true);

      // istersen kullanıcıya küçük bir ipucu:
      if (items.length === 0) {
        setSuggestError("Sonuç bulunamadı.");
      } else {
        setSuggestError(null);
      }
    } catch (e) {
      console.error(e);
      setSuggestError("Arama sırasında hata oluştu.");
      setSuggestOpen(true);
    }
  };

  // Scanner sonucu: inputa bas + barkoddan detaya git
  const handleScanResult = async (text: string) => {
    const code = normalizeBarcode(text);
    setQuery(code);
    closeScanner();
    try {
      await goToComponentByBarcode(code);
    } catch (e) {
      console.error(e);
      setSuggestError("Bu barkoda ait komponent bulunamadı.");
      setSuggestOpen(true);
    }
  };

  // Debounce autocomplete (3+ karakter, barkod değilse)
  useEffect(() => {
    const qText = normalizeText(query);
    const qBarcode = normalizeBarcode(query);

    // dropdown reset koşulları
    if (qText.length < 3 || isComponentBarcode(qBarcode)) {
      setSuggestOpen(false);
      setSuggestions([]);
      setSuggestLoading(false);
      setSuggestError(null);
      return;
    }

    setSuggestLoading(true);
    setSuggestError(null);

    const myReqId = ++suggestReqIdRef.current;

    const t = window.setTimeout(async () => {
      try {
        const items = await searchComponentsByText(qText, 8);
        if (myReqId !== suggestReqIdRef.current) return;

        setSuggestions(items);
        setSuggestOpen(true);
      } catch (e) {
        if (myReqId !== suggestReqIdRef.current) return;
        console.error(e);
        setSuggestions([]);
        setSuggestOpen(true);
        setSuggestError("Öneriler yüklenemedi.");
      } finally {
        if (myReqId !== suggestReqIdRef.current) return;
        setSuggestLoading(false);
      }
    }, 250);

    return () => window.clearTimeout(t);
  }, [query]);

  // dışarı tıklayınca dropdown kapat
  const suggestBoxRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDocDown = (e: MouseEvent) => {
      const el = suggestBoxRef.current;
      if (!el) return;
      if (!el.contains(e.target as any)) setSuggestOpen(false);
    };
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  const renderSuggestions = useMemo(() => {
    if (!suggestOpen) return null;

    return (
      <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-[9999] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg dark:border-gray-800 dark:bg-gray-900">
        {suggestLoading && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            Aranıyor…
          </div>
        )}

        {suggestError && (
          <div className="px-3 py-2 text-xs text-amber-600">{suggestError}</div>
        )}

        {!suggestLoading && !suggestError && suggestions.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
            Eşleşme yok.
          </div>
        )}

        {!suggestLoading && !suggestError && suggestions.length > 0 && (
          <div className="max-h-72 overflow-auto">
            {suggestions.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => {
                  setSuggestOpen(false);
                  navigate(`/details/component/${c.id}`);
                }}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-white/[0.05]"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm text-gray-800 dark:text-white/90">
                    {displayLabelOf(c)}
                  </div>

                  <div className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                    #{c.id}{c.barcode ? ` • ${normalizeBarcode(c.barcode)}` : ""}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }, [suggestOpen, suggestLoading, suggestError, suggestions, navigate]);

  const SearchBox = (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        runSearch();
      }}
      className="w-full"
    >
      <div className="relative w-full" ref={suggestBoxRef}>
        <span className="absolute -translate-y-1/2 pointer-events-none left-4 top-1/2">
          <Search className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        </span>

        <input
          ref={inputRef}
          type="text"
          placeholder="Barkod veya tanım ara"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            const q = normalizeText(query);
            const b = normalizeBarcode(query);
            if (q.length >= 3 && !isComponentBarcode(b)) setSuggestOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") setSuggestOpen(false);
          }}
          className="dark:bg-dark-900 h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-14 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-gray-900 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
        />

        <button
          type="button"
          aria-label="QR ile ara"
          onClick={openScanner}
          className="absolute right-2.5 top-1/2 inline-flex -translate-y-1/2 items-center justify-center
                    rounded-lg border border-gray-200 bg-gray-50 px-[7px] py-[4.5px]
                    text-gray-500 hover:bg-gray-100 dark:border-gray-800 dark:bg-white/[0.03] dark:text-gray-400"
          title="Barkod/QR Oku"
        >
          <QrCode className="w-5 h-5" />
        </button>

        {renderSuggestions}
      </div>
    </form>
  );

  return (
    <header className="sticky top-0 flex w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="items-center justify-center w-10 h-10 text-gray-500 border-gray-200 rounded-lg z-99999 dark:border-gray-800 lg:flex dark:text-gray-400 lg:h-11 lg:w-11 lg:border"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? (
              <X className="w-5 h-5" />
            ) : (
              <Menu className="w-5 h-5" />
            )}
          </button>

          {/* Mobile Search (logo yerine) */}
            <div className="lg:hidden flex-1 min-w-0">
              {SearchBox}
            </div>

          <button
            onClick={toggleApplicationMenu}
            className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg z-99999 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
          >
            <Menu className="w-5 h-5" />
          </button>

          {/* Desktop Search */}
          <div className="hidden lg:block xl:w-[430px]">
            {SearchBox}
          </div>
        </div>

        <div
          className={`${isApplicationMenuOpen ? "flex" : "hidden"} items-center justify-between w-full gap-4 px-5 py-4 lg:flex shadow-theme-md lg:justify-end lg:px-0 lg:shadow-none`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggleButton />
          </div>

          <UserDropdown me={me} />
        </div>
      </div>

      <BarcodeScannerModal open={scanOpen} onClose={closeScanner} onResult={handleScanResult} />
    </header>
  );
};

export default AppHeader;
