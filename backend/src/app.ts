import cors from "cors";
import express from "express";
import helmet from "helmet";
import { getPool } from "./db/pool.js";
import { authRouter } from "./modules/auth/authRouter.js";
import { bookingRouter } from "./modules/booking/bookingRouter.js";
import { checkinRouter } from "./modules/checkin/checkinRouter.js";
import { sandboxRouter } from "./modules/payment/sandboxRouter.js";
import { workshopRouter } from "./modules/workshops/workshopRouter.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/health/db", async (_req, res) => {
    const pool = getPool();
    const result = await pool.query<{ now: string }>("select now() as now");
    res.json({ ok: true, now: result.rows[0]?.now });
  });

  app.use("/api/auth", authRouter());
  app.use("/api/workshops", workshopRouter());
  app.use("/api/checkin", checkinRouter());
  app.use("/api", bookingRouter());
  app.use("/sandbox", sandboxRouter());

  // 404
  app.use((_req, res) => {
    res.status(404).json({ code: "NOT_FOUND" });
  });

  // Error handler
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error(err);
    res.status(500).json({ code: "INTERNAL_ERROR" });
  });

  return app;
}

