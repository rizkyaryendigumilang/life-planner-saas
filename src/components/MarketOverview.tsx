import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, CircleHelp, RefreshCw } from "lucide-react";
import { pb } from "../lib/pocketbase";
import { getMarketQuotes } from "../lib/marketData";
import type { Investment, MarketQuote } from "../types";
import { Badge, Button, Card, Skeleton } from "./ui";

export function MarketOverview() {
  const [quotes, setQuotes] = useState<MarketQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const load = async (refresh = false) => {
    if (refresh) setRefreshing(true); else setLoading(true);
    try {
      const rows = await pb.collection("market_watchlist").getFullList<any>({ sort: "sort_order,created" });
      const investments: Investment[] = rows.map((r) => ({
        id: r.id, user: r.user, mode: "Watchlist", asset_type: r.asset_type === "Crypto" ? "Crypto" : "Stock",
        symbol: r.symbol, asset_name: r.name || r.symbol, quantity: 0, average_price: 0,
      }));
      const result = await getMarketQuotes(investments);
      setQuotes([...result.values()].slice(0, 4));
    } catch { setQuotes([]); } finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void load(); }, []);
  return <Card className="overflow-hidden">
    <div className="flex items-center justify-between border-b border-line/10 p-5">
      <div className="flex items-center gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-ink"><Activity size={18}/></div><div><h2 className="font-semibold text-ink">Market watch</h2><p className="mt-0.5 text-xs text-ink-soft">Quotes from connected providers only</p></div></div>
      <Button variant="ghost" size="icon" onClick={() => void load(true)} disabled={refreshing} aria-label="Refresh market watch"><RefreshCw size={15} className={refreshing ? "animate-spin" : ""}/></Button>
    </div>
    {loading ? <div className="space-y-3 p-5">{[1,2,3].map((x) => <Skeleton key={x} className="h-12 w-full"/>)}</div> : quotes.length ? <div className="divide-y divide-line/10">{quotes.map((q) => <div key={q.symbol} className="flex items-center justify-between gap-3 px-5 py-3.5"><div><p className="text-sm font-semibold text-ink">{q.symbol}</p><p className="mt-0.5 text-xs text-ink-soft">{q.source}</p></div><div className="text-right"><p className="text-sm font-semibold tabular-nums">{q.price == null ? "—" : new Intl.NumberFormat("en-US", { style: "currency", currency: q.currency === "—" ? "USD" : q.currency, maximumFractionDigits: 4 }).format(q.price)}</p><Badge tone={q.marketStatus === "live" ? "success" : "neutral"}>{q.marketStatus === "live" ? "Live" : "Unavailable"}</Badge></div></div>)}</div> : <div className="p-8 text-center"><CircleHelp size={22} className="mx-auto text-ink-faint"/><p className="mt-3 text-sm font-medium text-ink">No quote feed connected</p><p className="mx-auto mt-1 max-w-sm text-xs leading-5 text-ink-soft">Your watchlist can still be maintained, but prices will stay blank until a trusted market-data API is configured.</p><a href="#" onClick={(e) => { e.preventDefault(); window.dispatchEvent(new CustomEvent("life-planner:navigate", { detail: "portfolio" })); }} className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-ink">Open portfolio <ArrowUpRight size={13}/></a></div>}
  </Card>;
}
