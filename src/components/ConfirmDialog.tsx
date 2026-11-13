import React from "react";
import { AlertTriangle, Info } from "lucide-react";
import { Button, Dialog } from "./ui";

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "primary";
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "danger",
  loading = false,
  onConfirm,
}: ConfirmDialogProps) {
  const handleConfirm = async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
    await onConfirm();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      className="max-w-md"
      title={
        <div className="flex items-center gap-2.5">
          <div
            className={`grid h-8 w-8 place-items-center rounded-lg ${
              variant === "danger"
                ? "bg-negative/10 text-negative"
                : "bg-accent/10 text-accent"
            }`}
          >
            {variant === "danger" ? (
              <AlertTriangle size={17} strokeWidth={2.2} />
            ) : (
              <Info size={17} strokeWidth={2.2} />
            )}
          </div>
          <span className="text-base font-semibold text-ink">{title}</span>
        </div>
      }
    >
      <div className="space-y-4 pt-1">
        <p className="text-sm leading-relaxed text-ink-soft whitespace-pre-line">
          {description}
        </p>

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-line/10">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            {cancelLabel}
          </Button>
          <Button
            type="button"
            variant={variant === "danger" ? "danger" : "primary"}
            size="md"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? "Memproses..." : confirmLabel}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
