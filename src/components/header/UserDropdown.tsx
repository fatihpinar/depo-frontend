import { useState } from "react";
import { DropdownItem } from "../ui/dropdown/DropdownItem";
import { Dropdown } from "../ui/dropdown/Dropdown";
import { useNavigate } from "react-router-dom";
import { clearAuth } from "../auth/storage";

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
        className="flex items-center text-gray-700 dropdown-toggle dark:text-gray-400"
      >
        
        {/* Üst bar: full name (yoksa username) */}
        <span className="block mr-1 font-medium text-theme-sm">{displayName}</span>

        <svg
          className={`stroke-gray-500 dark:stroke-gray-400 transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
          width="18"
          height="20"
          viewBox="0 0 18 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
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
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
              >
                <path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5Z" />
                <path d="M4 20a8 8 0 0 1 16 0Z" />
              </svg>
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
              <svg
                className="fill-gray-500 group-hover:fill-gray-700 dark:fill-gray-400 dark:group-hover:fill-gray-300"
                width="24"
                height="24"
                viewBox="0 0 24 24"
              >
                <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm1 15h-2v-2h2v2Zm1.07-7.75-.9.92A2.5 2.5 0 0 0 12 13h-1v-1a3.5 3.5 0 0 1 1.02-2.49l1.2-1.2a1.5 1.5 0 1 0-2.12-2.12 1.49 1.49 0 0 0-.44 1.06H9a3 3 0 1 1 5.07 2.34Z" />
              </svg>
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
          <svg
            className="fill-gray-500 group-hover:fill-gray-700 dark:group-hover:fill-gray-300"
            width="24"
            height="24"
            viewBox="0 0 24 24"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1 19.247c-.414 0-.75-.336-.75-.75v-4.252h-1.5v4.252c0 1.243 1.007 2.25 2.25 2.25H18.5c1.243 0 2.25-1.007 2.25-2.25V5.496c0-1.243-1.007-2.25-2.25-2.25H15.1c-1.243 0-2.25 1.007-2.25 2.25v4.249h1.5V5.496c0-.414.336-.75.75-.75H18.5c.414 0 .75.336.75.75v12.001c0 .414-.336.75-.75.75H15.1ZM3.251 11.998c0 .216.091.41.237.547l4.607 4.61a.75.75 0 1 0 1.061-1.061L6.811 12.748H16a.75.75 0 0 0 0-1.5H6.815l2.34-2.843A.75.75 0 1 0 8.094 7.05l-4.572 4.575c-.166.137-.272.345-.272.373Z"
            />
          </svg>
          Çıkış
        </button>
      </Dropdown>
    </div>
  );
}
