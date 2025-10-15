import React, { useEffect, useMemo, useState } from "react";
import ReactSelect, { StylesConfig } from "react-select";

interface Option { value: string; label: string; disabled?: boolean; }
interface SelectProps {
  options: Option[];
  placeholder?: string;
  onChange: (value: string) => void;
  className?: string;
  defaultValue?: string;
  value?: string;
  disabled?: boolean;
  id?: string;
  name?: string;
}

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

  // theme: html.dark var mı?
  const isDark =
    typeof document !== "undefined" &&
    document.documentElement.classList.contains("dark");

  useEffect(() => { if (!isControlled) setSelectedValue(defaultValue ?? ""); }, [defaultValue, isControlled]);
  useEffect(() => { if (isControlled) setSelectedValue(value ?? ""); }, [value, isControlled]);

  const rsOptions = useMemo(
    () => options.map(o => ({ value: o.value, label: o.label, isDisabled: !!o.disabled })),
    [options]
  );

  const current = useMemo(() => {
    const v = isControlled ? (value ?? "") : selectedValue;
    return rsOptions.find(o => o.value === v) || null;
  }, [isControlled, selectedValue, value, rsOptions]);

  const handleChange = (opt: any) => {
    const next = opt?.value ?? "";
    if (!isControlled) setSelectedValue(next);
    onChange(next);
  };

  // react-select inline stil (tailwind’e yakın)
  const styles: StylesConfig = {
    control: (base, state) => ({
      ...base,
      minHeight: 44,
      borderRadius: 8,
      backgroundColor: "transparent",
      borderColor: state.isFocused
        ? (isDark ? "rgb(30 64 175)" : "rgb(147 197 253)") // dark:brand-800 / light:brand-300
        : (isDark ? "rgb(55 65 81)" : "rgb(209 213 219)"), // dark:gray-700 / gray-300
      boxShadow: state.isFocused ? "0 0 0 3px rgba(59,130,246,0.10)" : "none",
      ":hover": {
        borderColor: state.isFocused
          ? (isDark ? "rgb(30 64 175)" : "rgb(147 197 253)")
          : (isDark ? "rgb(75 85 99)" : "rgb(156 163 175)"),
      },
      paddingLeft: 8,
      paddingRight: 8,
      fontSize: 14,
      color: isDark ? "rgba(255,255,255,0.9)" : "rgb(17 24 39)", // dark:text-white/90 vs slate-900
    }),
    menuPortal: base => ({ ...base, zIndex: 9999 }),
    menu: base => ({
      ...base,
      borderRadius: 8,
      overflow: "hidden",
      boxShadow: "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
      backgroundColor: isDark ? "rgb(17 24 39)" : "white", // dark:bg-gray-900
      border: `1px solid ${isDark ? "rgb(55 65 81)" : "rgb(229 231 235)"}`,   // dark:gray-700 / gray-200
    }),
    option: (base, state) => ({
      ...base,
      fontSize: 14,
      backgroundColor: state.isSelected
        ? (isDark ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.15)")
        : state.isFocused
        ? (isDark ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.08)")
        : "transparent",
      color: isDark ? "rgba(255,255,255,0.9)" : "rgb(17 24 39)",
      ":active": { backgroundColor: isDark ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.12)" },
    }),
    singleValue: base => ({ ...base, color: isDark ? "rgba(255,255,255,0.9)" : "rgb(17 24 39)" }),
    placeholder: base => ({ ...base, color: isDark ? "rgba(255,255,255,0.4)" : "rgb(156 163 175)" }),
    input: base => ({ ...base, color: isDark ? "rgba(255,255,255,0.9)" : "rgb(17 24 39)" }),
    valueContainer: base => ({ ...base, paddingLeft: 4, paddingRight: 4 }),
    dropdownIndicator: base => ({ ...base, padding: 8 }),
    clearIndicator: base => ({ ...base, padding: 8 }),
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
      /* 🔽 her zaman aşağı */
      menuPlacement="bottom"
      /* menü ekran içinde kalsın */
      menuPosition="fixed"
      menuPortalTarget={typeof document !== "undefined" ? document.body : undefined}
      styles={styles}
      components={{ IndicatorSeparator: () => null }}
    />
  );
};

export default Select;
