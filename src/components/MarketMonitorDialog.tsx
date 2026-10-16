import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import { pb } from "../lib/pocketbase";
import type { MarketAssetType } from "../lib/marketData";

type MarketMonitorDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void;
};

const MARKET_TYPES: MarketAssetType[] = [
  "Stock",
  "Crypto",
  "Gold",
  "Currency",
];

const DEFAULTS: Record<
  MarketAssetType,
  {
    symbol: string;
    name: string;
    currency: string;
    exchange: string;
  }
> = {
  Stock: {
    symbol: "",
    name: "",
    currency: "IDR",
    exchange: "XIDX",
  },
  Crypto: {
    symbol: "",
    name: "",
    currency: "USD",
    exchange: "",
  },
  Gold: {
    symbol: "XAU",
    name: "Gold",
    currency: "IDR",
    exchange: "",
  },
  Currency: {
    symbol: "USDIDR",
    name: "US Dollar / Indonesian Rupiah",
    currency: "IDR",
    exchange: "",
  },
};

export function MarketMonitorDialog({
  open,
  onOpenChange,
  onSaved,
}: MarketMonitorDialogProps) {
  const [assetType, setAssetType] =
    useState<MarketAssetType>("Stock");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [exchange, setExchange] = useState("XIDX");

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    const defaults = DEFAULTS[assetType];

    setSymbol(defaults.symbol);
    setName(defaults.name);
    setCurrency(defaults.currency);
    setExchange(defaults.exchange);
  }, [open, assetType]);

  const reset = () => {
    setAssetType("Stock");
    setSymbol("");
    setName("");
    setCurrency("IDR");
    setExchange("XIDX");
    setSaving(false);
  };

  const close = () => {
    if (saving) return;

    reset();
    onOpenChange(false);
  };

  const handleTypeChange = (
    value: MarketAssetType,
  ) => {
    setAssetType(value);
  };

  const handleSave = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const user = pb.authStore.record?.id;

    if (!user) {
      toast.error(
        "Your session has expired. Please login again.",
      );
      return;
    }

    const normalizedSymbol =
      symbol.trim().toUpperCase();

    const normalizedName = name.trim();

    if (!normalizedSymbol) {
      toast.error("Market symbol is required.");
      return;
    }

    if (!normalizedName) {
      toast.error("Market name is required.");
      return;
    }

    try {
      setSaving(true);

      const existing =
        await pb
          .collection("market_watchlist")
          .getFirstListItem(
            `user = "${user}" && symbol = "${normalizedSymbol}"`,
          )
          .catch(() => null);

      if (existing) {
        toast.error(
          `${normalizedSymbol} is already in your market monitor.`,
        );
        return;
      }

      const currentItems =
        await pb
          .collection("market_watchlist")
          .getFullList({
            filter: `user = "${user}"`,
            sort: "-sort_order",
          });

      const nextSortOrder =
        currentItems.length > 0
          ? Math.max(
              ...currentItems.map(
                (item) =>
                  Number(item.sort_order || 0),
              ),
            ) + 1
          : 0;

      await pb
        .collection("market_watchlist")
        .create({
          user,
          asset_type: assetType,
          symbol: normalizedSymbol,
          name: normalizedName,
          exchange:
            exchange.trim() || "",
          currency:
            currency.trim().toUpperCase() ||
            "IDR",
          sort_order: nextSortOrder,
          is_active: true,
        });

      toast.success(
        `${normalizedSymbol} added to Market Monitor.`,
      );

      reset();
      onOpenChange(false);
      onSaved?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Unable to add market.",
      );
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          close();
        }
      }}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-line/15 bg-surface shadow-pop"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >
        <div className="flex items-center justify-between border-b border-line/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-ink">
              Add Market
            </h2>

            <p className="mt-1 text-sm text-ink-soft">
              Choose a market you want to monitor.
            </p>
          </div>

          <button
            type="button"
            onClick={close}
            disabled={saving}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-ink-faint transition hover:bg-muted hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={handleSave}
          className="space-y-5 px-6 py-6"
        >
          <div>
            <label className="mb-2 block text-sm font-medium text-ink-soft">
              Market Type
            </label>

            <select
              value={assetType}
              onChange={(event) =>
                handleTypeChange(
                  event.target
                    .value as MarketAssetType,
                )
              }
              disabled={saving}
              className="h-11 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm text-ink outline-none transition focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
            >
              {MARKET_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink-soft">
              Symbol
            </label>

            <input
              value={symbol}
              onChange={(event) =>
                setSymbol(event.target.value)
              }
              disabled={saving}
              placeholder={
                assetType === "Stock"
                  ? "e.g. BBCA"
                  : assetType === "Crypto"
                    ? "e.g. BTC"
                    : assetType === "Gold"
                      ? "XAU"
                      : "USDIDR"
              }
              className="h-11 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm uppercase text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
            />

            <p className="mt-1.5 text-xs text-ink-faint">
              {assetType === "Stock" &&
                "Use the IDX ticker symbol, for example BBCA or BBRI."}

              {assetType === "Crypto" &&
                "Use the crypto symbol, for example BTC or ETH."}

              {assetType === "Gold" &&
                "Use XAU for international spot gold."}

              {assetType === "Currency" &&
                "Use a six-character pair such as USDIDR."}
            </p>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-ink-soft">
              Display Name
            </label>

            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              disabled={saving}
              placeholder="e.g. Bank Central Asia"
              className="h-11 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">
                Currency
              </label>

              <input
                value={currency}
                onChange={(event) =>
                  setCurrency(event.target.value)
                }
                disabled={saving}
                placeholder="IDR"
                className="h-11 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm uppercase text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-medium text-ink-soft">
                Exchange
              </label>

              <input
                value={exchange}
                onChange={(event) =>
                  setExchange(event.target.value)
                }
                disabled={saving}
                placeholder="XIDX"
                className="h-11 w-full rounded-xl border border-line/15 bg-surface px-3 text-sm uppercase text-ink outline-none transition placeholder:text-ink-faint focus:border-ink/35 focus:ring-4 focus:ring-ink/[.05]"
              />
            </div>
          </div>

          {assetType === "Gold" && (
            <div className="rounded-xl border border-caution/25 bg-caution/10 px-4 py-3 text-xs leading-5 text-caution">
              Gold price is based on international
              spot gold and converted to IDR per
              gram. It is not the Antam retail or
              buyback price.
            </div>
          )}

          {assetType === "Stock" && (
            <div className="rounded-xl border border-line/10 bg-muted px-4 py-3 text-xs leading-5 text-ink-soft">
              IDX stock data currently uses the
              latest available EOD quote from
              Twelve Data.
            </div>
          )}

          <div className="flex justify-end gap-3 border-t border-line/10 pt-5">
            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="h-10 rounded-xl px-4 text-sm font-medium text-ink-soft transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={saving}
              className="h-10 rounded-xl bg-accent px-5 text-sm font-medium text-accent-ink transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Adding..."
                : "Add Market"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}