"use client";
/**
 * Shared UI primitives for feature panels. Use these (and Tailwind tokens:
 * bg-surface, bg-surface-2, text-muted, border-border, text-accent, bg-accent,
 * text-danger, text-success, text-warning) so every panel looks consistent.
 */
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(" ");
}

export function Panel({ title, description, children, actions }: {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-surface p-4 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{title}</h2>
          {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </header>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export function Button({ variant = "secondary", className, ...props }:
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "inline-flex h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" && "bg-accent text-accent-fg hover:opacity-90",
        variant === "secondary" && "border border-border bg-surface-2 hover:bg-border",
        variant === "danger" && "bg-danger text-white hover:opacity-90",
        variant === "ghost" && "hover:bg-surface-2",
        className,
      )}
    />
  );
}

export function Field({ label, hint, children, error }: {
  label: ReactNode; hint?: ReactNode; error?: ReactNode; children: (id: string) => ReactNode;
}) {
  const id = useId();
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {children(id)}
      {error ? <p className="text-xs text-danger">{error}</p> : hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

const inputCls =
  "h-9 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-accent";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cn(inputCls, props.className)} />;
}

/** Integer input with optional min/max clamping (clamps on blur). */
export function NumberField({ label, value, onChange, min = 0, max, hint }: {
  label: ReactNode; value: number; onChange: (v: number) => void; min?: number; max?: number; hint?: ReactNode;
}) {
  const [text, setText] = useState(String(value));
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setText(String(value));
  }
  const commit = () => {
    let n = parseInt(text, 10);
    if (Number.isNaN(n)) n = value;
    if (max !== undefined) n = Math.min(n, max);
    n = Math.max(n, min);
    setText(String(n));
    if (n !== value) onChange(n);
  };
  return (
    <Field label={label} hint={hint ?? (max !== undefined ? `Max ${max.toLocaleString()}` : undefined)}>
      {(id) => (
        <div className="flex gap-2">
          <TextInput id={id} inputMode="numeric" value={text} onChange={(e) => setText(e.target.value)}
            onBlur={commit} onKeyDown={(e) => e.key === "Enter" && commit()} />
          {max !== undefined && (
            <Button onClick={() => { setText(String(max)); onChange(max); }}>Max</Button>
          )}
        </div>
      )}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange, hint }: {
  label: ReactNode; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2 text-sm">
      <input type="checkbox" className="mt-0.5 size-4 accent-[var(--accent)]" checked={checked}
        onChange={(e) => onChange(e.target.checked)} />
      <span>{label}{hint && <span className="block text-xs text-muted">{hint}</span>}</span>
    </label>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warning" | "danger" | "success"; children: ReactNode }) {
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cn(
      "rounded-lg border px-3 py-2 text-sm",
      tone === "info" && "border-border bg-surface-2",
      tone === "warning" && "border-warning/40 bg-warning/10 text-warning",
      tone === "danger" && "border-danger/40 bg-danger/10 text-danger",
      tone === "success" && "border-success/40 bg-success/10 text-success",
    )}>{children}</div>
  );
}

export function Segmented<T extends string>({ value, onChange, options }: {
  value: T; onChange: (v: T) => void; options: { value: T; label: ReactNode }[];
}) {
  return (
    <div role="radiogroup" className="inline-flex flex-wrap rounded-lg border border-border bg-surface-2 p-0.5">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn("rounded-md px-3 py-1.5 text-sm", value === o.value ? "bg-surface font-medium shadow-sm" : "text-muted hover:text-foreground")}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export type SelectItem<K extends string | number> = { id: K; label: string; detail?: string; disabled?: boolean };

/**
 * Searchable multi-select checklist (the web equivalent of the CLI's
 * multi_select / range input). Supports select all / none / invert on the
 * filtered set, and an "id range" box like "0-50 72".
 */
export function MultiSelect<K extends string | number>({ items, selected, onChange, height = 320, showIds = true }: {
  items: SelectItem<K>[]; selected: Set<K>; onChange: (s: Set<K>) => void; height?: number; showIds?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [range, setRange] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.label.toLowerCase().includes(q) || String(i.id) === q || i.detail?.toLowerCase().includes(q));
  }, [items, query]);
  const setMany = (ids: K[], on: boolean) => {
    const next = new Set(selected);
    for (const id of ids) on ? next.add(id) : next.delete(id);
    onChange(next);
  };
  const applyRange = () => {
    const ids = new Set<number>();
    for (const tok of range.split(/[\s,]+/).filter(Boolean)) {
      const m = tok.match(/^(\d+)(?:-(\d+))?$/);
      if (!m) continue;
      const a = +m[1], b = m[2] ? +m[2] : a;
      for (let i = Math.min(a, b); i <= Math.max(a, b); i++) ids.add(i);
    }
    setMany(items.filter((i) => typeof i.id === "number" && ids.has(i.id as number) && !i.disabled).map((i) => i.id), true);
  };
  const enabled = filtered.filter((i) => !i.disabled).map((i) => i.id);
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <TextInput aria-label="Search" placeholder="Search…" value={query} onChange={(e) => setQuery(e.target.value)} className="min-w-0 flex-1 basis-40" />
        <TextInput aria-label="Select ids by range" placeholder="e.g. 0-50 72" value={range} onChange={(e) => setRange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && applyRange()} className="w-36 flex-none" />
        <Button onClick={applyRange}>Add range</Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button variant="ghost" onClick={() => setMany(enabled, true)}>Select all{query && " shown"}</Button>
        <Button variant="ghost" onClick={() => setMany(enabled, false)}>Clear{query && " shown"}</Button>
        <Button variant="ghost" onClick={() => {
          const next = new Set(selected);
          for (const id of enabled) next.has(id) ? next.delete(id) : next.add(id);
          onChange(next);
        }}>Invert</Button>
        <span className="ml-auto text-muted">{selected.size} selected</span>
      </div>
      <ul className="overflow-y-auto rounded-lg border border-border" style={{ maxHeight: height }}>
        {filtered.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">Nothing matches “{query}”.</li>}
        {filtered.map((i) => (
          <li key={String(i.id)} className="border-b border-border last:border-0">
            <label className={cn("flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-surface-2", i.disabled && "opacity-50")}>
              <input type="checkbox" className="size-4 accent-[var(--accent)]" disabled={i.disabled}
                checked={selected.has(i.id)} onChange={(e) => setMany([i.id], e.target.checked)} />
              {showIds && <span className="w-12 flex-none font-mono text-xs text-muted">{String(i.id)}</span>}
              <span className="min-w-0 flex-1 truncate">{i.label}</span>
              {i.detail && <span className="flex-none text-xs text-muted">{i.detail}</span>}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Grid of labelled number inputs (CLI edit_ints_key equivalent). */
export function NumberGrid({ rows, onChange }: {
  rows: { key: string | number; label: string; value: number; max?: number }[];
  onChange: (key: string | number, value: number) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <NumberField key={String(r.key)} label={r.label} value={r.value} max={r.max} onChange={(v) => onChange(r.key, v)} />
      ))}
    </div>
  );
}

/** Determinate / indeterminate progress bar. `value` is 0..1; omit for indeterminate. */
export function ProgressBar({ value, label }: { value?: number | null; label?: string }) {
  const pct = value == null ? null : Math.max(0, Math.min(1, value)) * 100;
  return (
    <div
      role="progressbar"
      aria-label={label ?? "Progress"}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct == null ? undefined : Math.round(pct)}
      className="h-2 w-full overflow-hidden rounded-full bg-surface-2"
    >
      <div
        className={cn("h-full rounded-full bg-accent transition-[width]", pct == null && "w-1/3 animate-pulse")}
        style={pct == null ? undefined : { width: `${pct}%` }}
      />
    </div>
  );
}

/** Modal dialog built on the native <dialog> element (focus trap + Escape for free). */
export function Modal({ open, title, onClose, children, actions }: {
  open: boolean; title: ReactNode; onClose: () => void; children?: ReactNode; actions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-xl border border-border bg-surface p-0 text-foreground backdrop:bg-black/50"
    >
      {open && (
        <div className="space-y-4 p-4 sm:p-5">
          <h2 className="text-lg font-semibold">{title}</h2>
          {children && <div className="space-y-3 text-sm">{children}</div>}
          {actions && <div className="flex flex-wrap justify-end gap-2">{actions}</div>}
        </div>
      )}
    </dialog>
  );
}

/** Button that copies `text` to the clipboard and briefly confirms. */
export function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          /* clipboard unavailable */
        }
      }}
    >
      {done ? "Copied" : label}
    </Button>
  );
}
