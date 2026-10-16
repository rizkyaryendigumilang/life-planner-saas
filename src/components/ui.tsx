import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};
export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-accent text-accent-ink hover:opacity-90 active:translate-y-px",
    secondary: "bg-muted text-ink hover:bg-line/[.07]",
    outline: "border border-line/15 bg-surface text-ink hover:bg-muted",
    ghost: "bg-transparent text-ink-soft hover:bg-line/[.06] hover:text-ink",
    danger: "border border-negative/25 bg-negative/10 text-negative hover:bg-negative/[.16]",
  } as const;
  const sizes = {
    sm: "min-h-8 gap-1.5 rounded-lg px-3 text-xs",
    md: "min-h-10 gap-2 rounded-lg px-4 text-sm",
    lg: "min-h-11 gap-2 rounded-lg px-5 text-sm",
    icon: "h-9 w-9 rounded-lg p-0",
  } as const;
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center font-medium transition duration-150 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cx("rounded-xl border border-line/15 bg-surface", className)} {...props} />;
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-10 w-full rounded-lg border border-line/15 bg-surface px-3 text-base sm:text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-line/20 focus:border-ink/40 focus:ring-4 focus:ring-ink/[.06] disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-faint",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cx(
        "min-h-24 w-full resize-y rounded-lg border border-line/15 bg-surface px-3 py-2.5 text-base sm:text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-line/20 focus:border-ink/40 focus:ring-4 focus:ring-ink/[.06]",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label className={cx("mb-1.5 block text-xs font-medium text-ink-soft", className)} {...props}>
      {children}
    </label>
  );
}

type SelectOption = {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
};

function nodeText(node: React.ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => nodeText(child)).join("");
  if (React.isValidElement(node)) return nodeText((node.props as { children?: React.ReactNode }).children);
  return "";
}

function collectOptions(children: React.ReactNode): SelectOption[] {
  const options: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as {
      value?: string | number;
      label?: string;
      icon?: React.ReactNode;
      disabled?: boolean;
      children?: React.ReactNode;
    };
    if (props.value === undefined || props.value === null) return;
    const text = props.label ?? nodeText(props.children);
    options.push({
      value: String(props.value),
      label: (text || String(props.value)).replace(/\s+/g, " ").trim(),
      icon: props.icon,
      disabled: Boolean(props.disabled),
    });
  });
  return options;
}

type SelectPanel = {
  left: number;
  width: number;
  maxHeight: number;
  top?: number;
  bottom?: number;
};

type SelectProps = {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  children: React.ReactNode;
  className?: string;
  disabled?: boolean;
  name?: string;
  placeholder?: string;
  id?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "value" | "defaultValue" | "onChange" | "children" | "name" | "id">;

export function Select({
  value,
  onValueChange,
  defaultValue,
  children,
  className,
  disabled,
  name,
  placeholder = "Select an option",
  id,
  ...props
}: SelectProps) {
  const options = useMemo(() => collectOptions(children), [children]);
  const [uncontrolled, setUncontrolled] = useState(defaultValue ?? "");
  const current = value !== undefined ? value : uncontrolled;
  const selected = options.find((option) => option.value === current);
  const searchable = options.length > 7;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [panel, setPanel] = useState<SelectPanel | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return options;
    return options.filter((option) => option.label.toLowerCase().includes(term));
  }, [options, query]);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    setQuery("");
    if (refocus) triggerRef.current?.focus();
  }, []);

  const commit = useCallback(
    (next: string) => {
      if (value === undefined) setUncontrolled(next);
      onValueChange?.(next);
      close();
    },
    [close, onValueChange, value],
  );

  const position = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 6;
    const width = Math.max(rect.width, 208);
    const left = Math.min(Math.max(rect.left, 8), Math.max(8, window.innerWidth - width - 8));
    const spaceBelow = window.innerHeight - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;
    setPanel({
      left,
      width,
      maxHeight: Math.max(150, Math.min(300, placeAbove ? spaceAbove : spaceBelow)),
      ...(placeAbove ? { bottom: window.innerHeight - rect.top + gap } : { top: rect.bottom + gap }),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    position();
    const onReflow = () => position();
    window.addEventListener("resize", onReflow);
    window.addEventListener("scroll", onReflow, true);
    return () => {
      window.removeEventListener("resize", onReflow);
      window.removeEventListener("scroll", onReflow, true);
    };
  }, [open, position]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close(false);
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    const match = options.findIndex((option) => option.value === current && !option.disabled);
    setActive(match >= 0 ? match : 0);
    if (!searchable) return;
    const timer = window.setTimeout(() => searchRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.querySelector<HTMLElement>(`[data-option="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const move = useCallback(
    (direction: number) => {
      if (!filtered.length) return;
      let index = active;
      for (let step = 0; step < filtered.length; step += 1) {
        index = (index + direction + filtered.length) % filtered.length;
        if (!filtered[index].disabled) break;
      }
      setActive(index);
    },
    [active, filtered],
  );

  const onPanelKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      move(1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      move(-1);
    } else if (event.key === "Home") {
      event.preventDefault();
      setActive(0);
    } else if (event.key === "End") {
      event.preventDefault();
      setActive(Math.max(0, filtered.length - 1));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[active];
      if (option && !option.disabled) commit(option.value);
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      close(false);
    } else if (!searchable && event.key.length === 1 && /\S/.test(event.key)) {
      const term = event.key.toLowerCase();
      const index = filtered.findIndex((option) => option.label.toLowerCase().startsWith(term));
      if (index >= 0) setActive(index);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((previous) => !previous)}
        onKeyDown={(event) => {
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className={cx(
          "flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-line/15 bg-surface px-3 text-left text-sm text-ink outline-none transition hover:border-line/20 focus:border-ink/40 focus:ring-4 focus:ring-ink/[.06] disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-faint",
          className,
        )}
        {...props}
      >
        <span className={cx("flex min-w-0 flex-1 items-center gap-2", !selected && "text-ink-faint")}>
          {selected?.icon && <span className="grid h-4 w-4 shrink-0 place-items-center">{selected.icon}</span>}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
        <ChevronDown size={15} className={cx("shrink-0 text-ink-faint transition duration-150", open && "rotate-180")} />
      </button>

      {name && <input type="hidden" name={name} value={current} />}

      {open &&
        panel &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            tabIndex={-1}
            onKeyDown={onPanelKeyDown}
            style={{ left: panel.left, top: panel.top, bottom: panel.bottom, width: panel.width, maxHeight: panel.maxHeight }}
            className="fixed z-[200] flex flex-col overflow-hidden rounded-xl border border-line/15 bg-surface p-1.5 shadow-pop outline-none"
          >
            {searchable && (
              <div className="relative mb-1">
                <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => {
                    setQuery(event.target.value);
                    setActive(0);
                  }}
                  placeholder="Search"
                  aria-label="Search options"
                  className="h-8 w-full rounded-lg border border-line/15 bg-canvas pl-8 pr-7 text-xs text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35"
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => {
                      setQuery("");
                      setActive(0);
                      searchRef.current?.focus();
                    }}
                    aria-label="Clear search"
                    className="absolute right-2 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded text-ink-faint transition hover:text-ink"
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filtered.length === 0 && <p className="px-2.5 py-3 text-xs text-ink-faint">No options found.</p>}
              {filtered.map((option, index) => {
                const isSelected = option.value === current;
                return (
                  <button
                    key={option.value}
                    type="button"
                    role="option"
                    data-option={index}
                    aria-selected={isSelected}
                    disabled={option.disabled}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => commit(option.value)}
                    className={cx(
                      "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:pointer-events-none disabled:opacity-40",
                      index === active ? "bg-line/[.07] text-ink" : "text-ink-soft",
                      isSelected && "font-medium text-ink",
                    )}
                  >
                    {option.icon && <span className="grid h-4 w-4 shrink-0 place-items-center text-ink-faint">{option.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    {isSelected && <Check size={15} className="shrink-0 text-ink" />}
                  </button>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}

export function SelectItem(_props: {
  value: string;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  label?: string;
  disabled?: boolean;
}) {
  return null;
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
  className?: string;
}) {
  const styles = {
    neutral: "border-line/10 bg-muted text-ink-soft",
    accent: "border-line/15 bg-line/[.05] text-ink",
    success: "border-positive/25 bg-positive/10 text-positive",
    warning: "border-caution/25 bg-caution/10 text-caution",
    danger: "border-negative/25 bg-negative/10 text-negative",
  } as const;
  return (
    <span className={cx("inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[11px] font-medium leading-none", styles[tone], className)}>
      {children}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-line/[.07]", className)} />;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  description,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const t = window.setTimeout(() => dialogRef.current?.querySelector<HTMLElement>("input,button,select,textarea")?.focus(), 20);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, onOpenChange]);
  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      className="dialog-backdrop fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onOpenChange(false);
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cx(
          "dialog-scroll w-full max-w-xl rounded-t-2xl border border-line/15 bg-surface p-5 shadow-pop sm:rounded-xl sm:p-6",
          className,
        )}
      >
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-line/10 pb-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
              {title}
            </h2>
            {description && <p className="mt-1 text-sm text-ink-soft">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Close dialog"
            onClick={() => onOpenChange(false)}
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-line/[.06] hover:text-ink"
          >
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
