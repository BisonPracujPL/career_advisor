import { useState, useEffect, useRef, ReactNode } from "react";

export interface ScoreRingProps {
  pct: number;
}

export function ScoreRing({ pct }: ScoreRingProps) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="score-ring" title={`Dopasowanie ${pct}%`}>
      <svg width="52" height="52" viewBox="0 0 52 52">
        <circle className="ring-bg" cx="26" cy="26" r={r} />
        <circle
          className="ring-fg"
          cx="26"
          cy="26"
          r={r}
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <span className="score-num">{pct}%</span>
    </div>
  );
}

export interface ChipProps {
  label: string;
  onRemove?: () => void;
  variant?: "skill" | "ok" | "miss" | "recommend" | "default";
}

export function Chip({ label, onRemove, variant = "skill" }: ChipProps) {
  return (
    <span className={`chip chip-${variant}`}>
      {label}
      {onRemove && (
        <button type="button" className="chip-x" onClick={onRemove} aria-label="Usuń">
          ×
        </button>
      )}
    </span>
  );
}

export interface CollapseProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

export function Collapse({ title, children, defaultOpen = true }: CollapseProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className={`collapse ${open ? "open" : ""}`}>
      <button type="button" className="collapse-head" onClick={() => setOpen((v) => !v)}>
        <span>{title}</span>
        <span className="chevron">{open ? "−" : "+"}</span>
      </button>
      {open && <div className="collapse-body">{children}</div>}
    </section>
  );
}

export interface SingleSelectOption {
  value: string;
  label: string;
}

export interface SingleSelectProps {
  value: string;
  options: SingleSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/**
 * Dropdown pojedynczego wyboru renderowany w DOM (nie natywny <select>).
 * Natywne <select> otwierają listę w warstwie systemowej, której nagrywarki
 * ekranu i zrzuty nie łapią — ten komponent renderuje panel w drzewie React,
 * więc jest widoczny na nagraniu.
 */
export function SingleSelect({
  value,
  options,
  onChange,
  placeholder = "Wybierz…",
  className,
}: SingleSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div className={`multi-select single-select ${className || ""}`} ref={ref}>
      <button
        type="button"
        className={`multi-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={current ? "" : "placeholder"}>
          {current ? current.label : placeholder}
        </span>
        <span className="chevron">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="multi-panel">
          {options.map((o) => (
            <button
              type="button"
              key={o.value || "__empty"}
              className={`single-option ${o.value === value ? "selected" : ""}`}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export interface MultiSelectOption {
  id: string;
  label: string;
}

export interface MultiSelectProps {
  label: string;
  placeholder: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function MultiSelect({ label, placeholder, options, selected, onChange }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const toggle = (id: string) => {
    onChange(
      selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]
    );
  };

  const summary =
    selected.length === 0
      ? placeholder
      : options
          .filter((o) => selected.includes(o.id))
          .map((o) => o.label)
          .join(", ");

  return (
    <div className="field multi-select" ref={ref}>
      <span className="field-label">{label}</span>
      <button
        type="button"
        className={`multi-trigger ${open ? "open" : ""}`}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={selected.length ? "" : "placeholder"}>{summary}</span>
        <span className="chevron">{open ? "▴" : "▾"}</span>
      </button>
      {open && (
        <div className="multi-panel">
          {selected.length > 0 && (
            <button
              type="button"
              className="multi-clear"
              onClick={() => onChange([])}
            >
              Wyczyść wybór
            </button>
          )}
          {options.map((o) => (
            <label key={o.id} className="multi-option">
              <input
                type="checkbox"
                checked={selected.includes(o.id)}
                onChange={() => toggle(o.id)}
              />
              <span>{o.label}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
