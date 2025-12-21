import { useState } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth/storage";
import { UserRound, HelpCircle, LogOut, CircleUserRound, ChevronDown } from "lucide-react";

export type Me = {
  id: number;
  username: string | null;
  full_name: string | null;
  email: string | null;
  role_key?: string | null;
  role_name?: string | null;
  permissions?: string[];
};

export default function UserDropdown({ me = null }: { me?: Me | null }) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }
  function closeDropdown() {
    setIsOpen(false);
  }
  function handleSignOut() {
    clearAuth();
    navigate("/signin", { replace: true });
  }

  const displayName = me?.full_name ?? me?.username ?? "Kullanıcı";
  const displayUsername = me?.username ?? "";
  const displayEmail = me?.email ?? "";

  return (
    <div className="relative">
      <button
        onClick={toggleDropdown}
        className="flex items-center min-w-0 max-w-[220px] sm:max-w-[320px] text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        {/* Theme icon ile aynı boy: 20px */}
        <CircleUserRound className="w-5 h-5 mr-2 text-gray-500 dark:text-gray-400 shrink-0" />

        {/* Taşmayı engelle */}
        <span className="block mr-1 font-medium text-theme-sm truncate min-w-0">
          {displayName}
        </span>

        <ChevronDown
  className={`w-4 h-4 ml-1 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
/>

      </button>

      <Dropdown
        isOpen={isOpen}
        onClose={closeDropdown}
        className="absolute right-0 mt-[17px] flex w-[260px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark"
      >
        {/* Açılır panel başlığı: önce username, sonra e-posta */}
        <div>
          {displayUsername && (
            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
              {displayUsername}
            </span>
          )}
          {displayEmail && (
            <span className="mt-0.5 block text-theme-xs text-gray-500 dark:text-gray-400">
              {displayEmail}
            </span>
          )}
        </div>

        {/* Menü */}
        <ul className="flex flex-col gap-1 pt-4 pb-3 border-b border-gray-200 dark:border-gray-800">
          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/profile"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <UserRound className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" />
              Profil
            </DropdownItem>
          </li>

          <li>
            <DropdownItem
              onItemClick={closeDropdown}
              tag="a"
              to="/support"
              className="flex items-center gap-3 px-3 py-2 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300"
            >
              <HelpCircle className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" />
              Destek
            </DropdownItem>
          </li>
        </ul>

        {/* Çıkış */}
        <button
          onClick={() => {
            closeDropdown();
            handleSignOut();
          }}
          className="flex items-center gap-3 px-3 py-2 mt-3 font-medium text-gray-700 rounded-lg group text-theme-sm hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-white/5 dark:hover:text-gray-300 w-full text-left"
        >
          <LogOut className="w-5 h-5 text-gray-500 group-hover:text-gray-700 dark:text-gray-400 dark:group-hover:text-gray-300" />
          Çıkış
        </button>
      </Dropdown>
    </div>
  );
}
