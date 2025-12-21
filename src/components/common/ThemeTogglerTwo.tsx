import { useTheme } from "../../context/ThemeContext";
import { Sun, Moon } from "lucide-react";

export default function ThemeTogglerTwo() {
  const { toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center justify-center text-white transition-colors rounded-full size-14 bg-brand-500 hover:bg-brand-600"
      type="button"
      aria-label="Tema değiştir"
    >
      {/* Dark modda güneş, light modda ay */}
      <Sun className="hidden dark:block w-5 h-5" />
      <Moon className="dark:hidden w-5 h-5" />
    </button>
  );
}
