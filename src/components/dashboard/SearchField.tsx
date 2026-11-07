"use client";
// FIX 5: the one shared search field (dashboard filter block + HUD Opportunities
// tab): icon absolutely positioned inside the field, input padded 40px on the
// left so the placeholder always reads ("Search title and summary").
import { useId } from "react";
import { Search } from "lucide-react";
import "./system.css";

export default function SearchField({
  value,
  onChange,
  placeholder,
  label = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  label?: string;
}) {
  const id = useId();
  return (
    <div className="bm-searchfield">
      <label htmlFor={id} className="bm-sr-only">
        {label}
      </label>
      <Search size={16} aria-hidden="true" className="bm-searchfield__icon" />
      <input
        id={id}
        type="search"
        className="bm-input bm-searchfield__input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete="off"
      />
    </div>
  );
}
