import { Router } from "express";
import { buildCalendarIcs, toIcsDateKey, addIcsDays } from "../services/calendar-service.mjs";
import { pb, authenticatePocketBase, escapeFilterValue, getPocketBaseError } from "../services/pb.mjs";
import { authenticateRequest, authenticateShortcutToken } from "../middleware/auth.mjs";
import { rateLimit } from "../middleware/rate-limit.mjs";

export async function collectCalendarEvents(userId) {
  const filter = `user = "${escapeFilterValue(userId)}"`;
  const [tasks, trips, goals, experiences] = await Promise.all([
    pb.collection("life_planner").getFullList({ filter, sort: "due_date" }),
    pb.collection("travel_trips").getFullList({ filter, sort: "start_date" }),
    pb.collection("goals").getFullList({ filter, sort: "target_date" }),
    pb.collection("experiences").getFullList({ filter, sort: "start_date" }),
  ]);

  const events = [];

  for (const task of tasks) {
    const start = toIcsDateKey(task.due_date);
    if (!start || String(task.status || "").toLowerCase() === "done") continue;
    events.push({
      uid: `task-${task.id}@life-planner`,
      start,
      end: addIcsDays(start, 1),
      title: `Task: ${task.title || "Untitled task"}`,
      description: [
        task.priority ? `Priority: ${task.priority}` : "",
        task.category ? `Category: ${task.category}` : "",
        task.description || "",
      ]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const trip of trips) {
    const start = toIcsDateKey(trip.start_date);
    if (!start) continue;
    const finish = toIcsDateKey(trip.end_date) || start;
    events.push({
      uid: `trip-${trip.id}@life-planner`,
      start,
      end: addIcsDays(finish < start ? start : finish, 1),
      title: `Trip: ${trip.name || "Untitled trip"}`,
      location: trip.destination || "",
      description: trip.notes || "",
    });
  }

  for (const goal of goals) {
    const start = toIcsDateKey(goal.target_date);
    if (!start) continue;
    const target = Number(goal.target_amount || 0);
    const current = Number(goal.current_amount || 0);
    const percent =
      target > 0 ? Math.round((current / target) * 100) : Math.round(Number(goal.progress || 0));
    events.push({
      uid: `goal-${goal.id}@life-planner`,
      start,
      end: addIcsDays(start, 1),
      title: `Goal: ${goal.name || "Untitled goal"}`,
      description: [`Progress: ${percent}%`, goal.status ? `Status: ${goal.status}` : "", goal.notes || ""]
        .filter(Boolean)
        .join("\n"),
    });
  }

  for (const item of experiences) {
    const start = toIcsDateKey(item.start_date);
    if (!start || String(item.status || "").toLowerCase() === "cancelled") continue;
    const finish = toIcsDateKey(item.end_date) || start;
    events.push({
      uid: `experience-${item.id}@life-planner`,
      start,
      end: addIcsDays(finish < start ? start : finish, 1),
      title: `Experience: ${item.name || "Untitled experience"}`,
      location: item.location || "",
      description: [item.type ? `Type: ${item.type}` : "", item.status ? `Status: ${item.status}` : "", item.notes || ""]
        .filter(Boolean)
        .join("\n"),
    });
  }

  return events.sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
}

export function createCalendarRouter() {
  const router = Router();

  router.get("/api/calendar.ics", rateLimit({ windowMs: 60 * 1000, max: 60 }), async (req, res) => {
    try {
      const sessionAuthorized = await authenticateRequest(req);
      const shortcutAuthorized = sessionAuthorized ? false : await authenticateShortcutToken(req, { allowQuery: true });
      if (!sessionAuthorized && !shortcutAuthorized) {
        return res.status(401).json({
          success: false,
          message: "Unauthorized. Sign in or add a valid token to the calendar feed URL.",
        });
      }

      await authenticatePocketBase();
      const user = req.authUser;
      const events = await collectCalendarEvents(user.id);
      const calendarName = `Life Planner - ${user.name || user.email || "Calendar"}`;

      res.setHeader("Content-Type", "text/calendar; charset=utf-8");
      res.setHeader("Content-Disposition", 'inline; filename="life-planner.ics"');
      res.setHeader("Cache-Control", "no-store, max-age=0");
      return res.send(buildCalendarIcs(events, { calendarName }));
    } catch (error) {
      console.error("Calendar feed error:", getPocketBaseError(error));
      return res.status(500).json({ success: false, message: "Could not build the calendar feed." });
    }
  });

  return router;
}
