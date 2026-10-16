import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Eye,
  EyeOff,
  TrendingDown,
  TrendingUp,
  WalletCards,
} from "lucide-react";

import { pb } from "../lib/pocketbase";
import { formatIDR } from "../lib/utils";
import type { Investment, MarketQuote } from "../types";
import { getMarketQuotes } from "../lib/marketData";
import { Badge, Button, Card, Skeleton } from "./ui";

const HIDE_KEY = "life-planner:overview:portfolio-hidden";

function money(value: number) {
  return formatIDR(value);
}

export function PortfolioOverviewCard() {
  const [items, setItems] = useState<Investment[]>([]);
  const [quotes, setQuotes] = useState<Map<string, MarketQuote>>(
    new Map(),
  );
  const [loading, setLoading] = useState(true);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(HIDE_KEY);
    setHidden(stored === "true");
  }, []);

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        const records =
          await pb.collection("investments").getFullList<Investment>({
            sort: "-updated,-created",
          });

        if (!active) return;

        const portfolio = records.filter(
          (item) => item.mode === "Portfolio",
        );

        setItems(portfolio);

        const marketQuotes = await getMarketQuotes(portfolio);

        if (active) {
          setQuotes(marketQuotes);
        }
      } catch {
        if (!active) return;

        setItems([]);
        setQuotes(new Map());
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, []);

  const totals = useMemo(() => {
    return items.reduce(
      (acc, item) => {
        const invested =
          Number(item.quantity || 0) *
          Number(item.average_price || 0);

        const quote = quotes.get(
          `${item.asset_type}:${item.symbol.toUpperCase()}`,
        );

        const current =
          quote?.price != null
            ? Number(item.quantity || 0) * quote.price
            : null;

        acc.invested += invested;

        if (current != null) {
          acc.current += current;
          acc.hasCurrent = true;
        }

        return acc;
      },
      {
        invested: 0,
        current: 0,
        hasCurrent: false,
      },
    );
  }, [items, quotes]);

  const toggleHidden = () => {
    const next = !hidden;

    setHidden(next);
    localStorage.setItem(HIDE_KEY, String(next));
  };

  const navigateToPortfolio = () => {
    window.dispatchEvent(
      new CustomEvent("life-planner:navigate", {
        detail: "portfolio",
      }),
    );
  };

  if (hidden) {
    return (
      <Card className="p-5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <EyeOff size={16} />
              <h2 className="font-semibold">Portfolio</h2>
            </div>

            <p className="mt-1 text-xs text-ink-soft">
              Portfolio is hidden from your overview.
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHidden}
          >
            <Eye size={15} />
            Show
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-line/10 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <WalletCards size={16} />
            <h2 className="font-semibold">Portfolio</h2>

            <Badge>{items.length}</Badge>
          </div>

          <p className="mt-1 text-xs text-ink-soft">
            Your current investment snapshot.
          </p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleHidden}
            aria-label="Hide portfolio"
            title="Hide portfolio"
          >
            <EyeOff size={15} />
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={navigateToPortfolio}
          >
            View portfolio
            <ArrowRight size={15} />
          </Button>
        </div>
      </div>

      <div className="grid gap-3 p-5 sm:grid-cols-3">
        <div className="rounded-xl bg-muted p-4">
          <p className="text-[11px] text-ink-soft">
            Invested
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-6 w-28" />
          ) : (
            <p className="mt-1 text-lg font-semibold">
              {money(totals.invested)}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-muted p-4">
          <p className="text-[11px] text-ink-soft">
            Current value
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-6 w-28" />
          ) : (
            <p className="mt-1 text-lg font-semibold">
              {totals.hasCurrent
                ? money(totals.current)
                : "—"}
            </p>
          )}
        </div>

        <div className="rounded-xl bg-muted p-4">
          <p className="text-[11px] text-ink-soft">
            Unrealized P/L
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-6 w-28" />
          ) : (
            <div className="mt-1 flex items-center gap-1">
              {totals.hasCurrent &&
                (totals.current - totals.invested >= 0 ? (
                  <TrendingUp
                    size={15}
                    className="text-positive"
                  />
                ) : (
                  <TrendingDown
                    size={15}
                    className="text-negative"
                  />
                ))}

              <p
                className={
                  totals.hasCurrent &&
                  totals.current - totals.invested < 0
                    ? "text-lg font-semibold text-negative"
                    : totals.hasCurrent
                      ? "text-lg font-semibold text-positive"
                      : "text-lg font-semibold"
                }
              >
                {totals.hasCurrent
                  ? money(
                      totals.current -
                        totals.invested,
                    )
                  : "—"}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="divide-y divide-line/10 border-t border-line/10">
        {loading ? (
          <>
            <div className="p-4">
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="p-4">
              <Skeleton className="h-10 w-full" />
            </div>
          </>
        ) : items.length === 0 ? (
          <div className="p-8 text-center text-sm text-ink-soft">
            No portfolio holdings yet.
          </div>
        ) : (
          items.slice(0, 4).map((item) => {
            const quote = quotes.get(
              `${item.asset_type}:${item.symbol.toUpperCase()}`,
            );

            const invested =
              Number(item.quantity || 0) *
              Number(item.average_price || 0);

            const current =
              quote?.price != null
                ? Number(item.quantity || 0) *
                  quote.price
                : null;

            const pnl =
              current != null ? current - invested : null;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between gap-4 p-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold">
                      {item.symbol}
                    </p>

                    <Badge
                      tone={
                        quote?.marketStatus === "live"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {quote?.marketStatus === "live"
                        ? "Live"
                        : quote?.marketStatus === "eod"
                          ? "EOD"
                          : "Unavailable"}
                    </Badge>
                  </div>

                  <p className="truncate text-xs text-ink-soft">
                    {item.asset_name}
                  </p>
                </div>

                <div className="shrink-0 text-right">
                  <p className="text-sm font-semibold">
                    {quote?.price != null
                      ? money(quote.price)
                      : "—"}
                  </p>

                  <p
                    className={
                      pnl != null && pnl < 0
                        ? "text-[10px] text-negative"
                        : pnl != null
                          ? "text-[10px] text-positive"
                          : "text-[10px] text-ink-faint"
                    }
                  >
                    {pnl != null
                      ? `${pnl >= 0 ? "+" : ""}${money(pnl)}`
                      : "Unavailable"}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}