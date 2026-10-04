import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * A click-to-open, click-to-pick menu, used instead of the native <select>.
 *
 * Inside the device window (Chromium in Max's [jweb], drawn offscreen), a native
 * select's popup only stayed open while the mouse button was held: you had to press,
 * drag and release over an option. This one is ordinary page content, so it behaves
 * the same everywhere.
 */
export function Dropdown({
  value,
  options,
  onChange,
  disabled,
}: {
  value: number | string;
  options: readonly { value: number | string; label: string; disabled?: boolean }[];
  onChange: (value: number | string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const root = useRef<HTMLSpanElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const current = options.find((o) => o.value === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  // Open upwards when there is not room below (the inspector sits at the bottom of the window),
  // and scroll the current choice into view.
  useLayoutEffect(() => {
    if (!open || !root.current || !list.current) return;
    const r = root.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < Math.min(280, list.current.scrollHeight) + 8 && r.top > window.innerHeight - r.bottom);
    list.current.querySelector<HTMLElement>(".dd-option.current")?.scrollIntoView({ block: "nearest" });
  }, [open]);

  return (
    <span className="dd" ref={root}>
      <button type="button" className="dd-button" disabled={disabled} onClick={() => setOpen(!open)}>
        <span className="dd-label">{current?.label ?? ""}</span>
        <span className="dd-caret">▾</span>
      </button>
      {open && (
        <div className={up ? "dd-list up" : "dd-list"} ref={list}>
          {options.map((o) => (
            <button
              type="button"
              key={String(o.value)}
              disabled={o.disabled}
              className={o.value === value ? "dd-option current" : "dd-option"}
              onClick={() => {
                setOpen(false);
                if (o.value !== value) onChange(o.value);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

/** A Dropdown over a plain list of labels, valued by index. */
export function IndexDropdown({ value, options, onChange, disabled }: { value: number; options: readonly string[]; onChange: (i: number) => void; disabled?: boolean }) {
  return <Dropdown value={value} options={options.map((label, i) => ({ value: i, label }))} onChange={(v) => onChange(Number(v))} disabled={disabled} />;
}
