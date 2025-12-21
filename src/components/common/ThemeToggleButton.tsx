import { Sun, Moon } from "lucide-react";
import { useTheme } from "../../context/ThemeContext"; // sende hangi hook varsa onu kullan

export function ThemeToggleButton() {
  const { toggleTheme } = useTheme(); // "light" | "dark"

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className="inline-flex items-center justify-center w-10 h-10 rounded-lg
                text-gray-500 hover:bg-gray-100
                dark:text-gray-400 dark:hover:bg-gray-800"
    >
      <Sun className="hidden dark:block w-5 h-5" />
      <Moon className="dark:hidden w-5 h-5" />
    </button>
  );
}
