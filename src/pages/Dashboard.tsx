import {
  useEffect,
  useMemo,
  useState,
  type ComponentType,
} from "react";

import { ArrowUpRight,
  Check,
  CircleDollarSign,
  ListChecks,
  Plane,
  Plus,
  WalletCards,
  ScanLine,
  Eye, type LucideIcon } from 'lucide-react';

import { pb } from "../lib/pocketbase";

import {
  Badge,
  Button,
  Card,
  Skeleton,
} from "../components/ui";
import { BrandLogo } from "../components/BrandLogo";

import {
  formatIDR,
  formatDate,
} from "../lib/utils";

import type {
  Expense,
  Task,
  Trip,
  Investment,
  MarketQuote,
} from "../types";

import { getMarketQuotes } from "../lib/marketData";
import { MarketOverview } from "../components/MarketOverview";
import ScanBillDialog from "../components/ScanBillDialog";

type TimeframeKey =
  | "today"
  | "week"
  | "month"
  | "3months"
  | "6months"
  | "year"
  | "all";

type DateRange = {
  start: Date | null;
  end: Date | null;
};

const TIMEFRAMES: {
  key: TimeframeKey;
  label: string;
}[] = [
  {
    key: "today",
    label: "Today",
  },
  {
    key: "week",
    label: "This Week",
  },
  {
    key: "month",
    label: "This Month",
  },
  {
    key: "3months",
    label: "3 Months",
  },
  {
    key: "6months",
    label: "6 Months",
  },
  {
    key: "year",
    label: "This Year",
  },
  {
    key: "all",
    label: "All Time",
  },
];

function startOfDay(date: Date) {
  const d = new Date(date);

  d.setHours(0, 0, 0, 0);

  return d;
}

function endOfDay(date: Date) {
  const d = new Date(date);

  d.setHours(23, 59, 59, 999);

  return d;
}

function startOfWeek(date: Date) {
  const d = startOfDay(date);

  const day = d.getDay();

  d.setDate(
    d.getDate() +
      (day === 0 ? -6 : 1 - day),
  );

  return d;
}

function startOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    1,
  );
}

function endOfMonth(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
}

function getTimeframeRange(
  timeframe: TimeframeKey,
): DateRange {
  const now = new Date();

  switch (timeframe) {
    case "today":
      return {
        start: startOfDay(now),
        end: endOfDay(now),
      };

    case "week": {
      const start = startOfWeek(now);

      const end = new Date(start);

      end.setDate(start.getDate() + 6);

      return {
        start,
        end: endOfDay(end),
      };
    }

    case "month":
      return {
        start: startOfMonth(now),
        end: endOfMonth(now),
      };

    case "3months":
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth() - 2,
          1,
        ),
        end: endOfMonth(now),
      };

    case "6months":
      return {
        start: new Date(
          now.getFullYear(),
          now.getMonth() - 5,
          1,
        ),
        end: endOfMonth(now),
      };

    case "year":
      return {
        start: new Date(
          now.getFullYear(),
          0,
          1,
        ),
        end: new Date(
          now.getFullYear(),
          11,
          31,
          23,
          59,
          59,
          999,
        ),
      };

    default:
      return {
        start: null,
        end: null,
      };
  }
}

function parseRecordDate(
  value?: string | null,
) {
  if (!value) {
    return null;
  }

  const d = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T00:00:00`);

  return Number.isNaN(d.getTime())
    ? null
    : d;
}

function isWithinRange(
  value: string | null | undefined,
  range: DateRange,
) {
  const date = parseRecordDate(value);

  if (!date) {
    return false;
  }

  if (
    range.start &&
    date < range.start
  ) {
    return false;
  }

  if (
    range.end &&
    date > range.end
  ) {
    return false;
  }

  return true;
}

function formatMonthLabel(date: Date) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      month: "short",
      year: "numeric",
    },
  ).format(date);
}

function formatDayLabel(date: Date) {
  return new Intl.DateTimeFormat(
    "en-US",
    {
      day: "2-digit",
      month: "short",
    },
  ).format(date);
}

function getRangeLabel(
  timeframe: TimeframeKey,
) {
  return (
    TIMEFRAMES.find(
      (item) => item.key === timeframe,
    )?.label ?? "This Month"
  );
}

export function Dashboard({
  section,
}: {
  section?: string;
} = {}) {
  const [loading, setLoading] =
    useState(true);

  const [expenses, setExpenses] =
    useState<Expense[]>([]);

  const [tasks, setTasks] =
    useState<Task[]>([]);

  const [trips, setTrips] =
    useState<Trip[]>([]);

  const [investments, setInvestments] =
    useState<Investment[]>([]);

  const [quotes, setQuotes] =
    useState<Map<string, MarketQuote>>(
      new Map(),
    );

  const [timeframe, setTimeframe] =
    useState<TimeframeKey>("month");

  const [hoveredBar, setHoveredBar] =
    useState<{ name: string; date: Date; value: number } | null>(null);

  const [scanOpen, setScanOpen] =
    useState(false);

  const [reloadKey, setReloadKey] =
    useState(0);

  useEffect(() => {
    let active = true;

    (async () => {
      try {
        const [
          expenseRes,
          taskRes,
          tripRes,
          investmentRes,
        ] = await Promise.all([
          pb
            .collection("expenses")
            .getList<Expense>(1, 150, {
              sort: "-date",
            }),

          pb
            .collection("life_planner")
            .getList<Task>(1, 60, {
              sort: "order,due_date",
            }),

          pb
            .collection("travel_trips")
            .getList<Trip>(1, 25, {
              sort: "start_date",
            }),

          pb
            .collection("investments")
            .getList<Investment>(1, 50, {
              sort: "-updated,-created",
            }),
        ]);

        if (!active) {
          return;
        }

        setExpenses(expenseRes.items);
        setTasks(taskRes.items);
        setTrips(tripRes.items);
        setInvestments(
          investmentRes.items,
        );

        setQuotes(
          await getMarketQuotes(
            investmentRes.items,
          ),
        );
      } catch {
        if (!active) {
          return;
        }

        setExpenses([]);
        setTasks([]);
        setTrips([]);
        setInvestments([]);
        setQuotes(new Map());
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [reloadKey]);

  const range = useMemo(
    () =>
      getTimeframeRange(timeframe),
    [timeframe],
  );

  const filteredExpenses =
    useMemo(
      () =>
        expenses.filter((x) =>
          isWithinRange(
            x.date,
            range,
          ),
        ),
      [expenses, range],
    );

  const filteredTasks = useMemo(
    () =>
      tasks.filter((x) =>
        isWithinRange(
          x.due_date,
          range,
        ),
      ),
    [tasks, range],
  );

  const filteredTrips = useMemo(
    () =>
      trips.filter((x) =>
        isWithinRange(
          x.start_date,
          range,
        ),
      ),
    [trips, range],
  );

  const income =
    filteredExpenses
      .filter(
        (x) => x.type === "Income",
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0,
      );

  const out =
    filteredExpenses
      .filter(
        (x) => x.type === "Expense",
      )
      .reduce(
        (sum, x) =>
          sum + Number(x.amount || 0),
        0,
      );

  const chartData = useMemo(() => {
    if (!filteredExpenses.length) {
      return [];
    }

    const daily =
      timeframe === "today" ||
      timeframe === "week";

    const groups = new Map<
      string,
      {
        name: string;
        date: Date;
        value: number;
      }
    >();

    filteredExpenses.forEach(
      (expense) => {
        const date = parseRecordDate(
          expense.date,
        );

        if (!date) {
          return;
        }

        const key = daily
          ? `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
          : `${date.getFullYear()}-${date.getMonth()}`;

        const current =
          groups.get(key);

        const delta =
          expense.type === "Income"
            ? Number(
                expense.amount || 0,
              )
            : -Number(
                expense.amount || 0,
              );

        if (current) {
          current.value += delta;
        } else {
          groups.set(key, {
            name: daily
              ? formatDayLabel(date)
              : formatMonthLabel(date),
            date,
            value: delta,
          });
        }
      },
    );

    return Array.from(
      groups.values(),
    ).sort(
      (a, b) =>
        a.date.getTime() -
        b.date.getTime(),
    );
  }, [
    filteredExpenses,
    timeframe,
  ]);

  const openTasks =
    filteredTasks.filter(
      (x) => x.status !== "Done",
    ).length;

  const portfolio =
    investments.filter(
      (x) => x.mode === "Portfolio",
    );

  const watchlist =
    investments.filter(
      (x) => x.mode === "Watchlist",
    );

  const portfolioValue =
    portfolio.reduce(
      (sum, item) => {
        const quote = quotes.get(
          `${item.asset_type}:${item.symbol.toUpperCase()}`,
        );

        return (
          sum +
          (quote?.price != null
            ? Number(
                item.quantity || 0,
              ) * quote.price
            : 0)
        );
      },
      0,
    );

  const hasPortfolioMarketValue =
    portfolio.some((item) => {
      return (
        quotes.get(
          `${item.asset_type}:${item.symbol.toUpperCase()}`,
        )?.price != null
      );
    });

  const pageTitle =
    section === "goals"
      ? "Goals"
      : section === "calendar"
        ? "Calendar"
        : "Good evening.";

  const pageSubtitle = section
    ? `Your ${section} workspace at a glance.`
    : "Here is what is happening across your life planner.";

  return (
    <>
    <div className="animate-rise">
      <div className="mb-7 flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-line/15 bg-surface px-2.5 py-1 text-xs text-ink-soft shadow-xs">
            <BrandLogo variant="mark" size="xs" />
            <span className="font-semibold text-ink">LifePlanner</span>
            <span className="text-line/20">•</span>
            <span>Personal Workspace</span>
          </div>
          <h1 className="text-3xl font-semibold tracking-[-.03em]">
            {pageTitle}
          </h1>

          <p className="mt-1 text-sm text-ink-soft">
            {pageSubtitle}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.dispatchEvent(new CustomEvent("life-planner:navigate", { detail: "finance" }))}
          >
            <Plus size={15} />
            Quick add
          </Button>

          <Button size="sm" onClick={() => setScanOpen(true)}>
            <ScanLine size={15} />
            Scan bill
          </Button>
        </div>
      </div>

      {/* Timeframe Segmented Control */}
      <div className="mb-5 flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="inline-flex items-center gap-1 rounded-xl bg-muted/60 p-1 border border-line/10 shadow-xs">
          {TIMEFRAMES.map((item) => {
            const isSelected = timeframe === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => {
                  setTimeframe(item.key);
                  setHoveredBar(null);
                  if (typeof navigator !== "undefined" && navigator.vibrate) {
                    navigator.vibrate(8);
                  }
                }}
                className={`relative whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                  isSelected
                    ? "bg-accent text-accent-ink font-semibold shadow-xs"
                    : "text-ink-soft hover:text-ink hover:bg-surface/50"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={CircleDollarSign}
          label="Balance"
          value={
            loading
              ? ""
              : formatIDR(
                  income - out,
                )
          }
          loading={loading}
          hint={`${getRangeLabel(
            timeframe,
          )} net cash flow`}
        />

        <Metric
          icon={ArrowUpRight}
          label="Income"
          value={
            loading
              ? ""
              : formatIDR(income)
          }
          loading={loading}
          hint={`${getRangeLabel(
            timeframe,
          )} recorded income`}
        />

        <Metric
          icon={ListChecks}
          label="Open tasks"
          value={
            loading
              ? ""
              : String(openTasks)
          }
          loading={loading}
          hint={`${getRangeLabel(
            timeframe,
          )} planner tasks`}
        />

        <Metric
          icon={Plane}
          label="Upcoming trips"
          value={
            loading
              ? ""
              : String(
                  filteredTrips.length,
                )
          }
          loading={loading}
          hint={`${getRangeLabel(
            timeframe,
          )} planned journeys`}
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_.65fr]">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-semibold">
                Cash flow
              </h2>

              <p className="mt-1 text-xs text-ink-soft">
                {hoveredBar
                  ? `${formatDate(hoveredBar.date)} · ${hoveredBar.value >= 0 ? "+" : ""}${formatIDR(hoveredBar.value)}`
                  : `${getRangeLabel(timeframe)} financial activity`}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {hoveredBar && (
                <button
                  type="button"
                  onClick={() => setHoveredBar(null)}
                  className="text-[10px] text-ink-soft hover:text-ink underline"
                >
                  Reset
                </button>
              )}
              <Badge tone={hoveredBar ? (hoveredBar.value >= 0 ? "success" : "danger") : "neutral"}>
                {hoveredBar
                  ? hoveredBar.value >= 0
                    ? "Surplus"
                    : "Deficit"
                  : getRangeLabel(timeframe)}
              </Badge>
            </div>
          </div>

          <div className="mt-5 h-64">
            {chartData.length ? (
              <div className="flex h-full flex-col justify-end">
                <div className="flex h-52 items-end gap-2 pb-1">
                  {chartData.map((item) => {
                    const max = Math.max(
                      ...chartData.map((x) => Math.abs(x.value)),
                      1,
                    );

                    const height = Math.max(
                      10,
                      Math.round((Math.abs(item.value) / max) * 92),
                    );

                    const isSelected = hoveredBar?.date.getTime() === item.date.getTime();

                    return (
                      <div
                        key={`${item.name}-${item.date.getTime()}`}
                        className="group relative flex min-w-0 flex-1 flex-col items-center justify-end h-full"
                        onMouseEnter={() => setHoveredBar(item)}
                        onMouseLeave={() => setHoveredBar(null)}
                        onClick={() => setHoveredBar(item)}
                      >
                        {/* Interactive floating tooltip on hover */}
                        <div className="pointer-events-none absolute -top-12 z-20 hidden flex-col items-center group-hover:flex transition-all duration-150 animate-in fade-in zoom-in-95">
                          <div className="rounded-lg bg-surface-elevated/95 dark:bg-muted px-2.5 py-1 text-center shadow-lg border border-line/15 backdrop-blur-md">
                            <p className="text-[10px] font-medium text-ink-soft whitespace-nowrap">
                              {formatDate(item.date)}
                            </p>
                            <p className={`text-xs font-bold tabular-nums whitespace-nowrap ${
                              item.value >= 0 ? "text-positive" : "text-negative"
                            }`}>
                              {item.value >= 0 ? "+" : ""}{formatIDR(item.value)}
                            </p>
                          </div>
                          <div className="h-1.5 w-1.5 rotate-45 bg-surface-elevated/95 dark:bg-muted border-r border-b border-line/15 -mt-1" />
                        </div>

                        {/* Bar with emerald/rose gradient */}
                        <div
                          className={`w-full max-w-10 rounded-t-md transition-all duration-200 cursor-pointer group-hover:scale-y-105 origin-bottom bg-gradient-to-t ${
                            item.value >= 0
                              ? "from-emerald-600 to-emerald-400 hover:from-emerald-500 hover:to-emerald-300 shadow-xs shadow-emerald-500/15"
                              : "from-rose-600 to-rose-400 hover:from-rose-500 hover:to-rose-300 shadow-xs shadow-rose-500/15"
                          } ${isSelected ? "ring-2 ring-accent" : ""}`}
                          style={{
                            height: `${height}%`,
                            opacity: hoveredBar && !isSelected ? 0.45 : 1,
                          }}
                        />
                      </div>
                    );
                  })}
                </div>

                {/* Zero baseline guide */}
                <div className="w-full border-b border-line/15" />

                {/* X-axis labels */}
                <div className="flex items-center gap-2 pt-2">
                  {chartData.map((item) => (
                    <div
                      key={`label-${item.name}-${item.date.getTime()}`}
                      className="flex min-w-0 flex-1 justify-center"
                    >
                      <span className="truncate text-[10px] font-medium text-ink-soft">
                        {item.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : loading ? (
              <Skeleton className="h-full w-full" />
            ) : (
              <div className="flex h-full flex-col items-center justify-center rounded-2xl border border-dashed border-line/20 bg-muted/20 p-6 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-ink-soft mb-3 shadow-xs">
                  <CircleDollarSign size={24} className="stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-ink">Belum ada transaksi</p>
                <p className="mt-1 max-w-xs text-xs text-ink-soft">
                  Tidak ada catatan arus kas pada periode {getRangeLabel(timeframe).toLowerCase()}.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent("life-planner:navigate", { detail: "finance" }))}
                >
                  <Plus size={13} />
                  Catat transaksi
                </Button>
              </div>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold">
            Next up
          </h2>

          <p className="mt-1 text-xs text-ink-soft">
            Commitments within the
            selected timeframe
          </p>

          <div className="mt-4 space-y-1">
            {loading ? (
              <>
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
                <Skeleton className="h-12" />
              </>
            ) : filteredTasks.length ? (
              filteredTasks
                .slice(0, 4)
                .map((task) => (
                  <div
                    key={task.id}
                    className="flex items-start gap-3 rounded-xl px-2 py-3 hover:bg-muted"
                  >
                    <div className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border border-line/15">
                      {task.status ===
                      "Done" ? (
                        <Check
                          size={14}
                        />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-negative" />
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p
                        className={
                          task.status ===
                          "Done"
                            ? "text-sm text-ink-faint line-through"
                            : "text-sm font-medium"
                        }
                      >
                        {task.title}
                      </p>

                      <p className="mt-0.5 text-xs text-ink-soft">
                        {formatDate(
                          task.due_date,
                        )}{" "}
                        ·{" "}
                        {
                          task.priority
                        }
                      </p>
                    </div>
                  </div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/20 bg-muted/20 p-6 text-center">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-ink-soft mb-2.5">
                  <ListChecks size={20} className="stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-ink">Semua komitmen selesai</p>
                <p className="mt-1 text-xs text-ink-soft">
                  Tidak ada tugas atau deadline terbuka pada periode ini.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-3.5 gap-1.5 text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent("life-planner:navigate", { detail: "planner" }))}
                >
                  <Plus size={13} />
                  Buka Planner
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Market Monitor */}
      <div className="mt-4">
        <MarketOverview />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <WalletCards size={16} />
                Portfolio
              </h2>

              <p className="mt-1 text-xs text-ink-soft">
                {portfolio.length}{" "}
                holding
                {portfolio.length ===
                1
                  ? ""
                  : "s"}
              </p>
            </div>

            <Badge>
              {hasPortfolioMarketValue
                ? formatIDR(
                    portfolioValue,
                  )
                : "—"}
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            {portfolio.length ? (
              portfolio
                .slice(0, 4)
                .map((item) => {
                  const q =
                    quotes.get(
                      `${item.asset_type}:${item.symbol.toUpperCase()}`,
                    );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-muted px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {
                            item.symbol
                          }
                        </p>

                        <p className="text-xs text-ink-soft">
                          {
                            item.asset_name
                          }
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {q?.price !=
                          null
                            ? formatIDR(
                                q.price,
                              )
                            : "—"}
                        </p>

                        <p className="text-[10px] text-ink-faint">
                          {q?.marketStatus ===
                          "live"
                            ? "Live"
                            : q?.marketStatus ===
                                "eod"
                              ? "EOD"
                              : "Unavailable"}
                        </p>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="rounded-xl bg-muted p-6 text-center text-sm text-ink-soft">
                No portfolio data
                yet.
              </p>
            )}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="flex items-center gap-2 font-semibold">
                <Eye size={16} />
                Watchlist
              </h2>

              <p className="mt-1 text-xs text-ink-soft">
                Assets you are
                monitoring
              </p>
            </div>

            <Badge>
              {watchlist.length}
            </Badge>
          </div>

          <div className="mt-4 space-y-2">
            {watchlist.length ? (
              watchlist
                .slice(0, 5)
                .map((item) => {
                  const q =
                    quotes.get(
                      `${item.asset_type}:${item.symbol.toUpperCase()}`,
                    );

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between rounded-xl bg-muted px-3 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold">
                          {
                            item.symbol
                          }
                        </p>

                        <p className="text-xs text-ink-soft">
                          {
                            item.asset_name
                          }
                        </p>
                      </div>

                      <div className="text-right">
                        <p className="text-sm font-semibold">
                          {q?.price !=
                          null
                            ? formatIDR(
                                q.price,
                              )
                            : "—"}
                        </p>

                        <p
                          className={
                            q?.percentChange !=
                              null &&
                            q.percentChange <
                              0
                              ? "text-[10px] text-negative"
                              : "text-[10px] text-positive"
                          }
                        >
                          {q?.percentChange !=
                          null
                            ? `${q.percentChange >= 0 ? "+" : ""}${q.percentChange.toFixed(2)}%`
                            : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="rounded-xl bg-muted p-6 text-center text-sm text-ink-soft">
                No watchlist data
                yet.
              </p>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-4">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line/10 p-5">
            <div>
              <h2 className="font-semibold">
                Recent transactions
              </h2>

              <p className="mt-1 text-xs text-ink-soft">
                Transactions from{" "}
                {getRangeLabel(
                  timeframe,
                ).toLowerCase()}
              </p>
            </div>
          </div>

          <div className="divide-y divide-line/10">
            {loading ? (
              [1, 2, 3].map(
                (item) => (
                  <div
                    key={item}
                    className="p-4"
                  >
                    <Skeleton className="h-8" />
                  </div>
                ),
              )
            ) : filteredExpenses.length ? (
              filteredExpenses
                .slice(0, 5)
                .map((expense) => (
                  <div
                    key={expense.id}
                    className="grid gap-2 p-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {
                          expense.category
                        }
                      </p>

                      <p className="text-xs text-ink-soft">
                        {formatDate(
                          expense.date,
                        )}

                        {expense.notes
                          ? ` · ${expense.notes}`
                          : ""}
                      </p>
                    </div>

                    <Badge
                      tone={
                        expense.type ===
                        "Income"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {
                        expense.type
                      }
                    </Badge>

                    <p
                      className={
                        expense.type ===
                        "Income"
                          ? "text-sm font-semibold text-positive"
                          : "text-sm font-semibold"
                      }
                    >
                      {expense.type ===
                      "Income"
                        ? "+"
                        : "-"}
                      {formatIDR(
                        expense.amount,
                      )}
                    </p>
                  </div>
                ))
            ) : (
              <div className="flex flex-col items-center justify-center p-10 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-muted text-ink-soft mb-3">
                  <WalletCards size={22} className="stroke-[1.5]" />
                </div>
                <p className="text-sm font-semibold text-ink">Belum ada riwayat transaksi</p>
                <p className="mt-1 text-xs text-ink-soft max-w-sm">
                  Belum ada mutasi keuangan tercatat untuk periode {getRangeLabel(timeframe).toLowerCase()}.
                </p>
                <Button
                  size="sm"
                  variant="outline"
                  className="mt-4 gap-1.5 text-xs"
                  onClick={() => window.dispatchEvent(new CustomEvent("life-planner:navigate", { detail: "finance" }))}
                >
                  <Plus size={13} />
                  Tambah transaksi
                </Button>
              </div>
            )}
          </div>
        </Card>
      </div>
    </div>

      <ScanBillDialog
        open={scanOpen}
        onOpenChange={setScanOpen}
        onSaved={() => setReloadKey((value) => value + 1)}
      />
    </>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  hint,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  loading: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-ink-soft">
            {label}
          </p>

          {loading ? (
            <Skeleton className="mt-2 h-7 w-28" />
          ) : (
            <p className="mt-1 text-xl font-semibold tracking-tight tabular-nums">
              {value}
            </p>
          )}
        </div>

        <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted">
          <Icon size={17} />
        </div>
      </div>

      <p className="mt-4 text-[11px] text-ink-faint">
        {hint}
      </p>
    </Card>
  );
}


