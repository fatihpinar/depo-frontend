import { useState } from "react";
import { ThemeToggleButton } from "../common/ThemeToggleButton";
import UserDropdown from "./UserDropdown";
import { Link } from "react-router";
import { Menu, MoreHorizontal } from "lucide-react";

// Define the interface for the props
interface HeaderProps {
  onClick?: () => void; // Optional function that takes no arguments and returns void
  onToggle: () => void;
}

const Header: React.FC<HeaderProps> = ({ onClick, onToggle }) => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };

  return (
    <header className="sticky top-0 flex w-full bg-white border-gray-200 z-99999 dark:border-gray-800 dark:bg-gray-900 lg:border-b">
      <div className="flex flex-col items-center justify-between grow lg:flex-row lg:px-6">
        <div className="flex items-center justify-between w-full gap-2 px-3 py-3 border-b border-gray-200 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-4">
          <button
            className="block w-10 h-10 text-gray-500 lg:hidden dark:text-gray-400"
            onClick={onToggle}
            aria-label="Toggle sidebar"
            type="button"
          >
            <Menu className="w-5 h-5" />
          </button>

          <button
            onClick={onClick}
            className="items-center justify-center hidden w-10 h-10 text-gray-500 border-gray-200 rounded-lg z-99999 dark:border-gray-800 lg:flex dark:text-gray-400 lg:h-11 lg:w-11 lg:border"
            aria-label="Toggle sidebar (desktop)"
            type="button"
          >
            <Menu className="w-5 h-5" />
          </button>

          <Link to="/" className="lg:hidden">
            <img className="dark:hidden" src="./images/logo/logo.svg" alt="Logo" />
            <img className="hidden dark:block" src="./images/logo/logo-dark.svg" alt="Logo" />
          </Link>

          <button
            onClick={toggleApplicationMenu}
            className="flex items-center justify-center w-10 h-10 text-gray-700 rounded-lg z-99999 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 lg:hidden"
            aria-label="Toggle header menu"
            type="button"
          >
            <MoreHorizontal className="w-6 h-6" />
          </button>
        </div>

        <div
          className={`${
            isApplicationMenuOpen ? "flex" : "hidden"
          } items-center justify-end w-full gap-4 px-5 py-4 lg:flex shadow-theme-md lg:px-0 lg:shadow-none`}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            <ThemeToggleButton />
          </div>

          <UserDropdown />
        </div>
      </div>
    </header>
  );
};

export default Header;
