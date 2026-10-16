import { useEffect, useMemo, useState } from "react";
import { Eye, Pencil, Plus, RefreshCw, Trash2, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { pb } from "../lib/pocketbase";
import { formatIDR } from "../lib/utils";
import type { Investment, MarketQuote } from "../types";
import InvestmentDialog from "../components/InvestmentDialog";
import { Badge, Button, Card } from "../components/ui";
import { toast } from "sonner";
import { getMarketQuotes, isMarketDataConfigured } from "../lib/marketData";

function money(value: number) {
  return formatIDR(value);
}

export function Portfolio() {
  const [items, setItems] = useState<Investment[]>([]);
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(new Map());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Investment | null>(null);

  const load = async () => {
    try {
      const records = await pb.collection("investments").getFullList<Investment>({
        sort: "-updated,-created",
      });
      setItems(records);
      setQuotes(await getMarketQuotes(records));
    } catch {
      setItems([]);
      setQuotes(new Map());
      toast.error("Unable to load portfolio.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const next = await getMarketQuotes(items);
      setQuotes(next);
      toast.success("Market prices refreshed.");
    } finally {
      setRefreshing(false);
    }
  };

  const portfolio = items.filter((item) => item.mode === "Portfolio");
  const watchlist = items.filter((item) => item.mode === "Watchlist");

  const totals = useMemo(() => {
    return portfolio.reduce(
      (acc, item) => {
        const invested = Number(item.quantity || 0) * Number(item.average_price || 0);
        const quote = quotes.get(item.symbol.toUpperCase());
        const current =
          quote?.price != null ? Number(item.quantity || 0) * quote.price : null;

        acc.invested += invested;
        if (current != null) {
          acc.current += current;
          acc.hasCurrent = true;
        }
        return acc;
      },
      { invested: 0, current: 0, hasCurrent: false },
    );
  }, [portfolio, quotes]);

  const save = async (data: Record<string, unknown>) => {
    try {
      const user = pb.authStore.record?.id;
      if (!user) throw new Error("Not authenticated.");

      if (editing) {
        const updated = await pb.collection("investments").update<Investment>(editing.id, {
          ...data,
          user,
        });
        setItems((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        toast.success("Investment updated.");
      } else {
        const created = await pb.collection("investments").create<Investment>({
          ...data,
          user,
        });
        setItems((current) => [created, ...current]);
        toast.success("Investment added.");
      }

      setOpen(false);
      setEditing(null);
      const nextItems = editing
        ? items.map((item) => (item.id === editing.id ? ({ ...editing, ...data } as Investment) : item))
        : [{ ...(data as Investment), id: "new" }, ...items];
      setQuotes(await getMarketQuotes(nextItems));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to save investment.");
      throw error;
    }
  };

  const remove = async (item: Investment) => {
    if (!window.confirm(`Delete ${item.symbol} from your ${item.mode.toLowerCase()}?`)) return;
    try {
      await pb.collection("investments").delete(item.id);
      const next = items.filter((row) => row.id !== item.id);
      setItems(next);
      setQuotes(await getMarketQuotes(next));
      toast.success("Investment removed.");
    } catch {
      toast.error("Unable to delete investment.");
    }
  };

  const quoteFor = (item: Investment) =>
    quotes.get(item.symbol.toUpperCase());

  const openAdd = () => {
    setEditing(null);
    setOpen(true);
  };

  const openEdit = (item: Investment) => {
    setEditing(item);
    setOpen(true);
  };

  const renderMarketStatus = (quote?: MarketQuote) => {
    if (!quote || quote.marketStatus === "unavailable") {
      return <Badge>Price unavailable</Badge>;
    }
    return (
      <Badge tone={quote.marketStatus === "live" ? "success" : "neutral"}>
        {quote.marketStatus === "live" ? "Live" : "EOD"}
      </Badge>
    );
  };

  return (
    <div className="animate-rise">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">Portfolio</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Track your holdings separately from your watchlist.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => void refresh()} disabled={refreshing || !items.length}>
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh price
          </Button>
          <Button onClick={openAdd}>
            <Plus size={16} />
            Add investment
          </Button>
        </div>
      </div>

      {!isMarketDataConfigured() && (
        <Card className="mb-4 border border-caution/25 bg-muted p-4">
          <p className="text-sm font-medium">Market data is not configured.</p>
          <p className="mt-1 text-xs text-ink-soft">
            Set <code>MARKET_DATA_API_KEY</code> in the backend <code>.env</code> and <code>VITE_MARKET_DATA_ENABLED=true</code> in the frontend environment. Keep provider credentials server-side. No fake prices are shown.
          </p>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Invested</p>
          <p className="mt-1 text-xl font-semibold">{money(totals.invested)}</p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Current value</p>
          <p className="mt-1 text-xl font-semibold">
            {totals.hasCurrent ? money(totals.current) : "—"}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-xs text-ink-soft">Unrealized P/L</p>
          <p className="mt-1 text-xl font-semibold">
            {totals.hasCurrent ? money(totals.current - totals.invested) : "—"}
          </p>
        </Card>
      </div>

      <section className="mt-4">
        <div className="mb-3 flex items-center gap-2">
          <WalletCards size={17} />
          <h2 className="font-semibold">Portfolio</h2>
          <Badge>{portfolio.length}</Badge>
        </div>

        <Card className="overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-ink-soft">Loading portfolio...</div>
          ) : portfolio.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-soft">
              Your portfolio is empty. Add a holding when you actually own an asset.
            </div>
          ) : (
            <div className="divide-y divide-line/10">
              {portfolio.map((item) => {
                const quote = quoteFor(item);
                const invested = Number(item.quantity || 0) * Number(item.average_price || 0);
                const current = quote?.price != null ? Number(item.quantity || 0) * quote.price : null;
                const pnl = current != null ? current - invested : null;
                return (
                  <div key={item.id} className="grid gap-4 p-5 lg:grid-cols-[1.2fr_.8fr_.8fr_.7fr_auto] lg:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{item.symbol}</p>
                        {renderMarketStatus(quote)}
                      </div>
                      <p className="text-sm text-ink-soft">{item.asset_name} · {item.asset_type}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Quantity</p>
                      <p className="text-sm font-medium">{item.quantity}</p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">Current price</p>
                      <p className="text-sm font-semibold">
                        {quote?.price != null ? money(quote.price) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-ink-faint">P/L</p>
                      <p className={`flex items-center gap-1 text-sm font-semibold ${pnl != null && pnl < 0 ? "text-negative" : pnl != null ? "text-positive" : ""}`}>
                        {pnl != null && (pnl >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />)}
                        {pnl != null ? money(pnl) : "—"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} aria-label="Edit investment">
                        <Pencil size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(item)} aria-label="Delete investment">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <section className="mt-6">
        <div className="mb-3 flex items-center gap-2">
          <Eye size={17} />
          <h2 className="font-semibold">Watchlist</h2>
          <Badge>{watchlist.length}</Badge>
        </div>

        <Card className="overflow-hidden">
          {watchlist.length === 0 ? (
            <div className="p-10 text-center text-sm text-ink-soft">
              No watchlist assets yet.
            </div>
          ) : (
            <div className="divide-y divide-line/10">
              {watchlist.map((item) => {
                const quote = quoteFor(item);
                return (
                  <div key={item.id} className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_auto_auto] sm:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{item.symbol}</p>
                        {renderMarketStatus(quote)}
                      </div>
                      <p className="text-sm text-ink-soft">{item.asset_name} · {item.asset_type}</p>
                    </div>
                    <p className="font-semibold">{quote?.price != null ? money(quote.price) : "—"}</p>
                    <p className={quote?.percentChange != null && quote.percentChange < 0 ? "text-negative" : "text-positive"}>
                      {quote?.percentChange != null ? `${quote.percentChange >= 0 ? "+" : ""}${quote.percentChange.toFixed(2)}%` : "—"}
                    </p>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => openEdit(item)} aria-label="Edit watchlist item">
                        <Pencil size={16} />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => void remove(item)} aria-label="Delete watchlist item">
                        <Trash2 size={16} />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <InvestmentDialog
        open={open}
        onOpenChange={(value) => {
          setOpen(value);
          if (!value) setEditing(null);
        }}
        investment={editing}
        onSave={save}
      />
    </div>
  );
}
