import { useEffect, useState } from "react";

interface Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string; // uncontrolled başlangıç değeri
  value?: string;        // controlled kullanım için
  disabled?: boolean;
  id?: string;
  name?: string;
}

// Select.tsx

// ... imports ve tipler aynı ...

const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Select an option",
  onChange,
  className = "",
  defaultValue = "",
  value,
  disabled = false,
  id,
  name,
}) => {
  const isControlled = value !== undefined;
  const [selectedValue, setSelectedValue] = useState<string>(defaultValue ?? "");

  useEffect(() => {
    if (!isControlled) setSelectedValue(defaultValue ?? "");
  }, [defaultValue, isControlled]);

  useEffect(() => {
    if (isControlled) setSelectedValue(value ?? "");
  }, [value, isControlled]);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const next = e.target.value;
    if (!isControlled) setSelectedValue(next);
    onChange(next);
  };

  const currentValue = isControlled ? value ?? "" : selectedValue;

  // 🔧 Eğer options içinde boş değerli bir seçenek varsa,
  // ekstra placeholder option'ı render etmeyelim.
  const hasEmptyOption = options.some((o) => o.value === "");

  return (
    <select
      id={id}
      name={name}
      disabled={disabled}
      className={`h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 pr-11 text-sm shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 ${
        currentValue ? "text-gray-800 dark:text-white/90" : "text-gray-400 dark:text-gray-400"
      } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${className}`}
      value={currentValue}
      onChange={handleChange}
    >
      {!hasEmptyOption && (
        <option
          value=""
          disabled
          className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
        >
          {placeholder}
        </option>
      )}

      {options.map((option) => (
        <option
          key={`${option.value}-${option.label}`}
          value={option.value}
          disabled={option.disabled}
          className="text-gray-700 dark:bg-gray-900 dark:text-gray-400"
        >
          {option.label}
        </option>
      ))}
    </select>
  );
};

export default Select;
