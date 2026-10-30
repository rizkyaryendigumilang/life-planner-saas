import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  Globe,
  Loader2,
  RefreshCw,
  Smartphone,
} from "lucide-react";

import { Badge, Button, Card, Skeleton } from "../components/ui";
import { API_BASE } from "../lib/hosts";
import { pb } from "../lib/pocketbase";
import { getCache, setCache } from "../lib/swr-cache";

const TOKEN_STORAGE_KEY = "lp-shortcut-token";

type CalendarKind = "task" | "trip" | "goal" | "experience";

type CalendarEvent = {
  id: string;
  kind: CalendarKind;
  title: string;
  start: string;
  end: string;
  location?: string;
  detail?: string;
};

const KIND_META: Record<CalendarKind, { label: string; dot: string; badge: string }> = {
  task: { label: "Task", dot: "bg-ink/60", badge: "border-line/15 bg-line/[.05] text-ink" },
  trip: { label: "Trip", dot: "bg-data-1", badge: "border-data-1/30 bg-data-1/10 text-data-1" },
  goal: { label: "Goal", dot: "bg-data-3", badge: "border-data-3/30 bg-data-3/10 text-data-3" },
  experience: { label: "Experience", dot: "bg-data-5", badge: "border-data-5/30 bg-data-5/10 text-data-5" },
};

const KIND_ORDER: CalendarKind[] = ["task", "trip", "goal", "experience"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function parseKey(key: string) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

function addDays(key: string, days: number) {
  const date = parseKey(key);
  date.setDate(date.getDate() + days);
  return dateKey(date);
}

function toKey(value?: string) {
  if (typeof value !== "string") return "";
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function readableDate(key: string) {
  const date = parseKey(key);
  return `${WEEKDAYS[(date.getDay() + 6) % 7]}, ${date.getDate()} ${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function relativeLabel(key: string, today: string) {
  if (key === today) return "Today";
  if (key === addDays(today, 1)) return "Tomorrow";
  if (key === addDays(today, -1)) return "Yesterday";
  return "";
}

export function Calendar() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [visible, setVisible] = useState<Record<CalendarKind, boolean>>({
    task: true,
    trip: true,
    goal: true,
    experience: true,
  });
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selected, setSelected] = useState(() => dateKey(new Date()));
  const [downloading, setDownloading] = useState(false);
  // The feed is opened by the phone, so the URL has to use an address the
  // phone can reach. The API prefers the public tunnel URL when one is up,
  // and falls back to the machine's LAN address otherwise.
  const [feedBase, setFeedBase] = useState(API_BASE);
  const [feedPublic, setFeedPublic] = useState(false);
  const [feedLanUrl, setFeedLanUrl] = useState("");

  const today = useMemo(() => dateKey(new Date()), []);

  useEffect(() => {
    let active = true;
    const token = pb.authStore.token;
    if (!token) return;

    fetch(`${API_BASE}/api/network-info`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => (response.ok ? response.json() : null))
      .then((body) => {
        if (!active || !body) return;
        if (body.url) setFeedBase(body.url);
        setFeedPublic(Boolean(body.reachableFromInternet));
        setFeedLanUrl(String(body.lanUrl || ""));
      })
      .catch(() => {
        /* keep the configured base when the address cannot be read */
      });

    return () => {
      active = false;
    };
  }, []);

  const load = useCallback(async (mode: "initial" | "refresh" = "initial", targetCursor = cursor) => {
    const cacheKey = `calendar_${targetCursor.year}_${targetCursor.month}`;
    const cached = getCache<CalendarEvent[]>(cacheKey);

    if (cached) {
      setEvents(cached);
      setLoading(false);
    } else if (mode === "initial") {
      setLoading(true);
    } else {
      setRefreshing(true);
    }

    try {
      const userId = pb.authStore.record?.id;
      if (!userId) return;

      // Date range window: 1 month before cursor to 1 month after cursor (+-1 month buffer)
      const startDate = new Date(targetCursor.year, targetCursor.month - 1, 1).toISOString().slice(0, 10);
      const endDate = new Date(targetCursor.year, targetCursor.month + 2, 0).toISOString().slice(0, 10);

      const taskFilter = `user = "${userId}" && due_date >= "${startDate}" && due_date <= "${endDate}"`;
      const tripFilter = `user = "${userId}" && start_date <= "${endDate}"`;
      const goalFilter = `user = "${userId}" && target_date >= "${startDate}" && target_date <= "${endDate}"`;
      const expFilter = `user = "${userId}" && start_date <= "${endDate}"`;

      const [tasks, trips, goals, experiences] = await Promise.all([
        pb.collection("life_planner").getFullList({
          filter: taskFilter,
          sort: "due_date",
          fields: "id,title,due_date,status,priority,category",
        }),
        pb.collection("travel_trips").getFullList({
          filter: tripFilter,
          sort: "start_date",
          fields: "id,name,destination,start_date,end_date,notes",
        }),
        pb.collection("goals").getFullList({
          filter: goalFilter,
          sort: "target_date",
          fields: "id,name,target_date,target_amount,current_amount,status",
        }),
        pb.collection("experiences").getFullList({
          filter: expFilter,
          sort: "start_date",
          fields: "id,name,start_date,end_date,location,type,status",
        }),
      ]);

      const next: CalendarEvent[] = [];

      for (const task of tasks as Array<Record<string, any>>) {
        const start = toKey(task.due_date);
        if (!start || String(task.status || "").toLowerCase() === "done") continue;
        next.push({
          id: `task-${task.id}`,
          kind: "task",
          title: task.title || "Untitled task",
          start,
          end: start,
          detail: [task.priority ? `${task.priority} priority` : "", task.category || ""].filter(Boolean).join(" · "),
        });
      }

      for (const trip of trips as Array<Record<string, any>>) {
        const start = toKey(trip.start_date);
        if (!start) continue;
        const end = toKey(trip.end_date) || start;
        next.push({
          id: `trip-${trip.id}`,
          kind: "trip",
          title: trip.name || "Untitled trip",
          start,
          end: end < start ? start : end,
          location: trip.destination || "",
          detail: trip.notes || "",
        });
      }

      for (const goal of goals as Array<Record<string, any>>) {
        const start = toKey(goal.target_date);
        if (!start || String(goal.status || "").toLowerCase() === "completed") continue;
        const target = Number(goal.target_amount || 0);
        const current = Number(goal.current_amount || 0);
        const percent = target > 0 ? Math.round((current / target) * 100) : 0;
        next.push({
          id: `goal-${goal.id}`,
          kind: "goal",
          title: goal.name || "Untitled goal",
          start,
          end: start,
          detail: `Target ${percent}% complete`,
        });
      }

      for (const item of experiences as Array<Record<string, any>>) {
        const start = toKey(item.start_date);
        if (!start || String(item.status || "").toLowerCase() === "cancelled") continue;
        const end = toKey(item.end_date) || start;
        next.push({
          id: `experience-${item.id}`,
          kind: "experience",
          title: item.name || "Untitled experience",
          start,
          end: end < start ? start : end,
          location: item.location || "",
          detail: [item.type || "", item.status || ""].filter(Boolean).join(" · "),
        });
      }

      next.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
      setEvents(next);
      setCache(`calendar_${targetCursor.year}_${targetCursor.month}`, next, 60_000);
    } catch (error) {
      console.error("Failed to load calendar:", error);
      toast.error("Could not load the calendar.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load("refresh", cursor);
  }, [cursor.year, cursor.month, load]);

  const activeEvents = useMemo(
    () => events.filter((event) => visible[event.kind]),
    [events, visible],
  );

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    for (const event of activeEvents) {
      let cursorKey = event.start;
      const end = event.end >= event.start ? event.end : event.start;
      let guard = 0;
      while (cursorKey <= end && guard < 400) {
        const list = map.get(cursorKey);
        if (list) list.push(event);
        else map.set(cursorKey, [event]);
        cursorKey = addDays(cursorKey, 1);
        guard += 1;
      }
    }
    return map;
  }, [activeEvents]);

  const grid = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1);
    const offset = (first.getDay() + 6) % 7;
    const start = new Date(cursor.year, cursor.month, 1 - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
      const key = dateKey(date);
      return {
        key,
        day: date.getDate(),
        inMonth: date.getMonth() === cursor.month && date.getFullYear() === cursor.year,
      };
    });
  }, [cursor]);

  const monthLabel = `${MONTH_NAMES[cursor.month]} ${cursor.year}`;

  const monthSummary = useMemo(() => {
    const prefix = `${cursor.year}-${pad(cursor.month + 1)}`;
    const counts: Record<CalendarKind, number> = { task: 0, trip: 0, goal: 0, experience: 0 };
    for (const event of activeEvents) {
      if (event.start.startsWith(prefix)) counts[event.kind] += 1;
    }
    return counts;
  }, [activeEvents, cursor]);

  const selectedEvents = byDay.get(selected) ?? [];

  const upcoming = useMemo(() => {
    const limit = addDays(today, 45);
    return activeEvents
      .filter((event) => (event.end >= today || event.start >= today) && event.start <= limit)
      .slice(0, 8);
  }, [activeEvents, today]);

  const monthCount = KIND_ORDER.reduce((total, kind) => total + monthSummary[kind], 0);

  const shiftMonth = (delta: number) => {
    setCursor((current) => {
      const next = new Date(current.year, current.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  };

  const goToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelected(dateKey(now));
  };

  const feedUrl = useMemo(() => {
    const base = `${feedBase}/api/calendar.ics`;
    if (typeof window === "undefined") return base;
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return token ? `${base}?token=${encodeURIComponent(token)}` : base;
  }, [feedBase]);

  const hasToken = typeof window !== "undefined" && Boolean(window.localStorage.getItem(TOKEN_STORAGE_KEY));

  const downloadIcs = async () => {
    setDownloading(true);
    try {
      const token = pb.authStore.token;
      const response = await fetch(`${API_BASE}/api/calendar.ics`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (!response.ok) throw new Error(`Request failed with ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "life-planner.ics";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Calendar file downloaded.");
    } catch (error) {
      console.error("Failed to download calendar:", error);
      toast.error("Could not download the calendar file.");
    } finally {
      setDownloading(false);
    }
  };

  const copyFeed = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      toast.success("Calendar link copied.");
    } catch {
      toast.error("Could not copy the link.");
    }
  };

  return (
    <div className="animate-rise space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-ink">Calendar</h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-soft">
            Setiap tanggal penting dari planner, perjalanan, goal, dan experience dalam satu tampilan. Feed-nya bisa
            disinkronkan ke kalender iPhone.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => void load("refresh")} disabled={refreshing}>
            {refreshing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={goToday}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line/10 px-4 py-3">
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
                <ChevronLeft size={17} />
              </Button>
              <p className="min-w-[168px] text-center text-sm font-medium text-ink">{monthLabel}</p>
              <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
                <ChevronRight size={17} />
              </Button>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {KIND_ORDER.map((kind) => {
                const meta = KIND_META[kind];
                const on = visible[kind];
                return (
                  <button
                    key={kind}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setVisible((current) => ({ ...current, [kind]: !current[kind] }))}
                    className={
                      "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition " +
                      (on ? "border-line/15 bg-line/[.05] text-ink" : "border-line/10 text-ink-faint hover:text-ink-soft")
                    }
                  >
                    <span className={"h-1.5 w-1.5 rounded-full " + (on ? meta.dot : "bg-line/25")} />
                    {meta.label}
                    <span className="tabular-nums text-ink-faint">{monthSummary[kind]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-7 border-b border-line/10 bg-muted/40">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-2 py-2 text-center text-[11px] font-medium uppercase tracking-[.08em] text-ink-faint">
                {day}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-px bg-line/10 p-px">
              {Array.from({ length: 42 }, (_, index) => (
                <div key={index} className="min-h-[68px] bg-surface p-2 sm:min-h-[104px]">
                  <Skeleton className="h-3 w-6" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-px bg-line/10">
              {grid.map((cell) => {
                const dayEvents = byDay.get(cell.key) ?? [];
                const isToday = cell.key === today;
                const isSelected = cell.key === selected;
                return (
                  <button
                    key={cell.key}
                    type="button"
                    onClick={() => setSelected(cell.key)}
                    className={
                      "min-h-[68px] bg-surface p-1.5 text-left align-top transition sm:min-h-[104px] sm:p-2 " +
                      (isSelected ? "bg-line/[.05] ring-1 ring-inset ring-ink/25" : "hover:bg-line/[.03]")
                    }
                  >
                    <span className="flex items-center justify-between gap-1">
                      <span
                        className={
                          "grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px] font-medium tabular-nums " +
                          (isToday
                            ? "bg-accent text-accent-ink"
                            : cell.inMonth
                              ? "text-ink"
                              : "text-ink-faint")
                        }
                      >
                        {cell.day}
                      </span>
                      {dayEvents.length > 0 && (
                        <span className="text-[10px] tabular-nums text-ink-faint sm:hidden">{dayEvents.length}</span>
                      )}
                    </span>

                    <span className="mt-1 hidden space-y-1 sm:block">
                      {dayEvents.slice(0, 2).map((event) => (
                        <span
                          key={event.id}
                          className="flex items-center gap-1.5 rounded-md border border-line/10 bg-canvas px-1.5 py-0.5"
                        >
                          <span className={"h-1.5 w-1.5 shrink-0 rounded-full " + KIND_META[event.kind].dot} />
                          <span className="truncate text-[11px] leading-4 text-ink-soft">{event.title}</span>
                        </span>
                      ))}
                      {dayEvents.length > 2 && (
                        <span className="block pl-1 text-[10px] text-ink-faint">+{dayEvents.length - 2} more</span>
                      )}
                    </span>

                    <span className="mt-1.5 flex flex-wrap gap-1 sm:hidden">
                      {dayEvents.slice(0, 4).map((event) => (
                        <span key={event.id} className={"h-1.5 w-1.5 rounded-full " + KIND_META[event.kind].dot} />
                      ))}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line/10 px-4 py-2.5 text-xs text-ink-soft">
            <span>
              <span className="tabular-nums font-medium text-ink">{monthCount}</span> item bulan ini
            </span>
            <span className="flex flex-wrap items-center gap-3">
              {KIND_ORDER.map((kind) => (
                <span key={kind} className="inline-flex items-center gap-1.5">
                  <span className={"h-1.5 w-1.5 rounded-full " + KIND_META[kind].dot} />
                  {KIND_META[kind].label}
                </span>
              ))}
            </span>
          </div>
        </Card>

        <div className="space-y-5">
          <Card className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-[.12em] text-ink-faint">
                  {relativeLabel(selected, today) || "Selected day"}
                </p>
                <p className="mt-1 text-sm font-medium text-ink">{readableDate(selected)}</p>
              </div>
              <Badge tone="neutral">{selectedEvents.length} item</Badge>
            </div>

            <div className="mt-4 space-y-2">
              {selectedEvents.length === 0 && (
                <p className="rounded-lg border border-dashed border-line/15 px-3 py-4 text-center text-xs text-ink-faint">
                  Tidak ada agenda di tanggal ini.
                </p>
              )}
              {selectedEvents.map((event) => (
                <div key={event.id} className="rounded-lg border border-line/10 bg-canvas px-3 py-2.5">
                  <div className="flex items-start gap-2.5">
                    <span className={"mt-1.5 h-2 w-2 shrink-0 rounded-full " + KIND_META[event.kind].dot} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink">{event.title}</p>
                      {event.detail && <p className="mt-0.5 truncate text-xs text-ink-soft">{event.detail}</p>}
                      {event.location && <p className="mt-0.5 truncate text-xs text-ink-faint">{event.location}</p>}
                      {event.start !== event.end && (
                        <p className="mt-0.5 text-[11px] text-ink-faint">
                          {event.start} → {event.end}
                        </p>
                      )}
                    </div>
                    <span className={"shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium " + KIND_META[event.kind].badge}>
                      {KIND_META[event.kind].label}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <CalendarDays size={15} className="text-ink-soft" />
              <p className="text-sm font-medium text-ink">Upcoming</p>
            </div>
            <div className="mt-3 space-y-2.5">
              {upcoming.length === 0 && <p className="text-xs text-ink-faint">Belum ada agenda dalam 45 hari ke depan.</p>}
              {upcoming.map((event) => (
                <button
                  key={event.id}
                  type="button"
                  onClick={() => {
                    setSelected(event.start);
                    const date = parseKey(event.start);
                    setCursor({ year: date.getFullYear(), month: date.getMonth() });
                  }}
                  className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-line/[.04]"
                >
                  <span className={"mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full " + KIND_META[event.kind].dot} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-ink">{event.title}</span>
                    <span className="block text-[11px] text-ink-faint">{readableDate(event.start)}</span>
                  </span>
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-2">
              <Smartphone size={15} className="text-ink-soft" />
              <p className="text-sm font-medium text-ink">Sync ke kalender device</p>
            </div>
            <p className="mt-2 text-xs leading-5 text-ink-soft">
              Feed ini berisi task (yang belum selesai), perjalanan, goal, dan experience. Perubahan di aplikasi akan
              ikut ter-update saat kalender melakukan refresh.
            </p>

            <div className="mt-3 space-y-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => void downloadIcs()} disabled={downloading}>
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                Download .ics
              </Button>

              <div className="rounded-lg border border-line/15 bg-canvas px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-medium uppercase tracking-[.1em] text-ink-faint">Subscribe URL</p>
                  <span
                    className={
                      "shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium " +
                      (feedPublic
                        ? "border-positive/25 bg-positive/10 text-positive"
                        : "border-caution/25 bg-caution/10 text-caution")
                    }
                  >
                    {feedPublic ? "Internet" : "LAN only"}
                  </span>
                </div>
                <p className="mt-1 break-all font-mono text-[11px] leading-4 text-ink-soft">{feedUrl}</p>
              </div>

              <Button variant="outline" size="sm" className="w-full" onClick={() => void copyFeed()}>
                <Copy size={14} />
                Copy subscribe URL
              </Button>

              {!feedPublic && (
                <div className="rounded-lg border border-line/10 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="shrink-0 text-ink-faint" />
                    <p className="text-[11px] font-medium text-ink">Ingin bisa di-subscribe dari jaringan mana pun?</p>
                  </div>
                  <p className="mt-1.5 text-[11px] leading-4 text-ink-soft">
                    Jalankan <span className="font-mono text-ink">npm run tunnel</span> di komputer ini. Alamat publik
                    akan dipakai otomatis oleh halaman ini.
                  </p>
                  {feedLanUrl && (
                    <p className="mt-1.5 break-all text-[10px] leading-4 text-ink-faint">
                      Alamat LAN saat ini: <span className="font-mono">{feedLanUrl}</span>
                    </p>
                  )}
                </div>
              )}

              {!hasToken && (
                <p className="rounded-lg border border-caution/25 bg-caution/10 px-3 py-2 text-[11px] leading-4 text-caution">
                  URL di atas belum punya token. Buka menu <span className="font-medium">Integrated to your device</span>{" "}
                  untuk membuat device token, lalu salin URL-nya kembali.
                </p>
              )}

              <div className="flex items-start gap-2 rounded-lg border border-line/10 px-3 py-2">
                <CalendarPlus size={14} className="mt-0.5 shrink-0 text-ink-faint" />
                <p className="text-[11px] leading-4 text-ink-soft">
                  Di iPhone: Settings → Apps → Calendar → Accounts → Add Account → Other → Add Subscribed Calendar, lalu
                  tempel URL di atas. Gunakan alamat <span className="font-medium text-ink">Internet</span> kalau kamu
                  ingin feed tetap jalan di luar rumah (jalankan <span className="font-mono">npm run tunnel</span> dulu);
                  kalau hanya di rumah, alamat LAN sudah cukup.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
