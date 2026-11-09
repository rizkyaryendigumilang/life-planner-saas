import { Router } from "express";

export function createHealthRouter({ pbUrl = "http://127.0.0.1:8090" } = {}) {
  const router = Router();

  router.get("/api/health", async (_req, res) => {
    res.json({
      success: true,
      status: "ok",
      service: "life-planner-saas-api",
      uptime: Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      pocketbase: pbUrl,
    });
  });

  return router;
}
