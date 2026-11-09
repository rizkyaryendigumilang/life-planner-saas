import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";

function cx(...parts: Array<string | undefined | false | null>) {
  return parts.filter(Boolean).join(" ");
}

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
};
export function Button({ className, variant = "primary", size = "md", type = "button", ...props }: ButtonProps) {
  const variants = {
    primary: "bg-accent text-accent-ink hover:opacity-90 active:scale-[0.98] active:translate-y-px",
    secondary: "bg-muted text-ink hover:bg-line/[.07] active:scale-[0.98] active:translate-y-px",
    outline: "border border-line/15 bg-surface text-ink hover:bg-muted active:scale-[0.98] active:translate-y-px",
    ghost: "bg-transparent text-ink-soft hover:bg-line/[.06] hover:text-ink active:scale-[0.98] active:translate-y-px",
    danger: "border border-negative/25 bg-negative/10 text-negative hover:bg-negative/[.16] active:scale-[0.98] active:translate-y-px",
  } as const;
  const sizes = {
    sm: "relative min-h-8 gap-1.5 rounded-lg px-3 text-xs before:absolute before:-inset-y-1.5 before:inset-x-0 before:content-['']",
    md: "min-h-10 gap-2 rounded-lg px-4 text-sm",
    lg: "min-h-11 gap-2 rounded-lg px-5 text-sm",
    icon: "relative h-9 w-9 rounded-lg p-0 before:absolute before:-inset-1 before:content-['']",
  } as const;
  return (
    <button
      type={type}
      className={cx(
        "inline-flex items-center justify-center font-medium select-none transition-[transform,background-color,border-color,color,opacity] duration-100 ease-out disabled:pointer-events-none disabled:opacity-50 touch-manipulation",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    />
  );
}

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cx(
        "relative rounded-xl border border-line/12 bg-surface shadow-xs transition-colors before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-xl before:bg-gradient-to-r before:from-transparent before:via-line/20 before:to-transparent",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        "min-h-10 w-full rounded-lg border border-line/15 bg-surface px-3 text-base sm:text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-line/20 focus:border-ink/40 focus:ring-4 focus:ring-ink/[.06] disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-faint aria-[invalid=true]:border-negative/50 aria-[invalid=true]:focus:ring-negative/[.08]",
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
        "min-h-24 w-full resize-y rounded-lg border border-line/15 bg-surface px-3 py-2.5 text-base sm:text-sm text-ink outline-none transition placeholder:text-ink-faint hover:border-line/20 focus:border-ink/40 focus:ring-4 focus:ring-ink/[.06] aria-[invalid=true]:border-negative/50 aria-[invalid=true]:focus:ring-negative/[.08]",
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
    let rafId = 0;
    const onReflow = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => position());
    };
    window.addEventListener("resize", onReflow, { passive: true });
    window.addEventListener("scroll", onReflow, { capture: true, passive: true });
    return () => {
      cancelAnimationFrame(rafId);
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
    const isFinePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    if (!isFinePointer) return;
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

      {typeof document !== "undefined" &&
        createPortal(
          <AnimatePresence>
            {open && panel && (
              <motion.div
                ref={panelRef}
                role="listbox"
                tabIndex={-1}
                onKeyDown={onPanelKeyDown}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", damping: 26, stiffness: 420 }}
                style={{
                  left: panel.left,
                  top: panel.top,
                  bottom: panel.bottom,
                  width: panel.width,
                  maxHeight: panel.maxHeight,
                  transformOrigin: panel.bottom !== undefined ? "bottom center" : "top center",
                }}
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
                      className="h-8 w-full rounded-lg border border-line/15 bg-canvas pl-8 pr-7 text-base sm:text-xs text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35"
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
              </motion.div>
            )}
          </AnimatePresence>,
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
    neutral: "border-line/12 bg-muted/60 text-ink-soft",
    accent: "border-line/15 bg-line/[.06] text-ink",
    success: "border-positive/20 bg-positive/10 text-positive",
    warning: "border-caution/20 bg-caution/10 text-caution",
    danger: "border-negative/20 bg-negative/10 text-negative",
  } as const;
  return (
    <span className={cx("inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium leading-normal tracking-tight select-none", styles[tone], className)}>
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
  const dragControls = useDragControls();

  const [isDesktop, setIsDesktop] = useState(() => {
    return typeof window !== "undefined" ? window.matchMedia("(min-width: 640px)").matches : true;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(min-width: 640px)");
    const onChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const shouldReduceMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onOpenChange(false);
    };
    document.addEventListener("keydown", handleKey);
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const isFinePointer = typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
    const t = window.setTimeout(() => {
      if (isFinePointer) {
        dialogRef.current?.querySelector<HTMLElement>("input,button,select,textarea")?.focus();
      }
    }, 40);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.body.style.overflow = oldOverflow;
      window.clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, onOpenChange]);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="dialog-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="dialog-backdrop fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) onOpenChange(false);
          }}
        >
          <motion.div
            key="dialog-content"
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={description ? `${titleId}-desc` : undefined}
            initial={
              shouldReduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, scale: 0.96, y: 14 }
                : { opacity: 0, y: "100%" }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : isDesktop
                ? { opacity: 1, scale: 1, y: 0 }
                : { opacity: 1, y: 0 }
            }
            exit={
              shouldReduceMotion
                ? { opacity: 0 }
                : isDesktop
                ? { opacity: 0, scale: 0.96, y: 10 }
                : { opacity: 0, y: "100%" }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.15 }
                : isDesktop
                ? { type: "spring", damping: 28, stiffness: 380, mass: 0.8 }
                : { type: "spring", damping: 32, stiffness: 360, mass: 0.8 }
            }
            drag={isDesktop ? false : "y"}
            dragListener={false}
            dragControls={dragControls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0.04, bottom: 0.4 }}
            onDragEnd={(_, info) => {
              if (isDesktop) return;
              // Apple WWDC 2018 momentum projection (deceleration rate 0.996)
              const projectedY = info.offset.y + (info.velocity.y / 1000) * (0.996 / (1 - 0.996));
              const isFlick = info.velocity.y > 380;
              const isPassedThreshold = info.offset.y > 80 || projectedY > 160;
              if (isFlick || isPassedThreshold) {
                if (typeof navigator !== "undefined" && navigator.vibrate) {
                  try {
                    navigator.vibrate(10);
                  } catch {
                    // ignore
                  }
                }
                onOpenChange(false);
              }
            }}
            className={cx(
              "dialog-scroll relative w-full max-w-xl rounded-t-2xl border border-line/15 bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-pop before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:rounded-t-2xl before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent sm:rounded-xl sm:p-6 sm:before:rounded-t-xl",
              className,
            )}
          >
            {/* iOS Grab Handle for Mobile Bottom Sheet */}
            <div
              className="flex w-full items-center justify-center pt-0 pb-3 sm:hidden cursor-grab active:cursor-grabbing touch-none select-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="h-1.5 w-10 rounded-full bg-line/25" />
            </div>

            <div className="mb-5 flex items-start justify-between gap-4 border-b border-line/10 pb-4">
              <div>
                <h2 id={titleId} className="text-lg font-semibold tracking-tight text-ink">
                  {title}
                </h2>
                {description && <p id={`${titleId}-desc`} className="mt-1 text-sm text-ink-soft">{description}</p>}
              </div>
              <button
                type="button"
                aria-label="Close dialog"
                onClick={() => onOpenChange(false)}
                className="relative grid h-8 w-8 shrink-0 place-items-center rounded-lg text-ink-soft transition hover:bg-line/[.06] hover:text-ink active:scale-95 before:absolute before:-inset-1.5 before:content-['']"
              >
                <X size={17} aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
