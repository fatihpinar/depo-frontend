import React, { useEffect, useMemo, useState } from "react";
import ReactSelect, { StylesConfig } from "react-select";

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

/** Wrapper: react-select ile portal + auto placement */
const Select: React.FC<SelectProps> = ({
  options,
  placeholder = "Seçiniz",
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

  // uncontrolled -> defaultValue güncellenirse senkronla
  useEffect(() => {
    if (!isControlled) setSelectedValue(defaultValue ?? "");
  }, [defaultValue, isControlled]);

  // controlled -> value değişirse senkronla
  useEffect(() => {
    if (isControlled) setSelectedValue(value ?? "");
  }, [value, isControlled]);

  const rsOptions = useMemo(
    () =>
      options.map((o) => ({
        value: o.value,
        label: o.label,
        isDisabled: !!o.disabled,
      })),
    [options]
  );

  const current = useMemo(() => {
    const val = isControlled ? (value ?? "") : selectedValue;
    return rsOptions.find((o) => o.value === val) || null;
  }, [isControlled, selectedValue, value, rsOptions]);

  const handleChange = (opt: any) => {
    const nextVal = opt?.value ?? "";
    if (!isControlled) setSelectedValue(nextVal);
    onChange(nextVal);
  };

  // Tailwind’e yakın basit stiller
  const styles: StylesConfig = {
    control: (base, state) => ({
      ...base,
      minHeight: 44, // h-11
      borderRadius: 8,
      borderColor: state.isFocused ? "rgb(147 197 253)" : "rgb(209 213 219)", // focus:border-brand-300 vs gray-300
      boxShadow: state.isFocused ? "0 0 0 3px rgba(59,130,246,0.1)" : "none",
      backgroundColor: "transparent",
      ":hover": { borderColor: state.isFocused ? "rgb(147 197 253)" : "rgb(156 163 175)" },
      paddingLeft: 8,
      paddingRight: 8,
      fontSize: 14,
    }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
    menu: (base) => ({
      ...base,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow:
        "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
    }),
    option: (base, state) => ({
      ...base,
      fontSize: 14,
      backgroundColor: state.isFocused
        ? "rgba(59,130,246,0.08)"
        : state.isSelected
        ? "rgba(59,130,246,0.15)"
        : "white",
      color: "#111827",
      ":active": { backgroundColor: "rgba(59,130,246,0.12)" },
    }),
    singleValue: (base) => ({ ...base, color: "#111827" }),
    placeholder: (base) => ({ ...base, color: "#9CA3AF" }),
    input: (base) => ({ ...base, color: "#111827" }),
    valueContainer: (base) => ({ ...base, paddingLeft: 4, paddingRight: 4 }),
    dropdownIndicator: (base) => ({ ...base, padding: 8 }),
    clearIndicator: (base) => ({ ...base, padding: 8 }),
    indicatorSeparator: () => ({ display: "none" }),
  };

  return (
    <ReactSelect
      inputId={id}
      name={name}
      isDisabled={disabled}
      className={className}
      options={rsOptions}
      value={current}
      onChange={handleChange}
      placeholder={placeholder}
      isClearable={false}
      // 🔑 Menü konumlandırma: aşağı açılmayı tercih eder, taşarsa yukarı; container’dan bağımsız
      menuPlacement="auto"
      menuPosition="fixed"
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      styles={styles}
      components={{
        IndicatorSeparator: () => null,
      }}
    />
  );
};

export default Select;
