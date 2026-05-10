import "dotenv/config";
import cron from "node-cron";
import { createApp } from "./app.js";
import { getPool } from "./db/pool.js";
import { runNotificationWorker } from "./modules/notifications/worker.js";
import { runAiWorker } from "./modules/workshops/aiWorker.js";
import { runCsvSyncJob } from "./modules/sync/csvWorker.js";

const PORT = Number(process.env.PORT || 3000);

async function main() {
  const pool = getPool();
  try {
    await pool.query("SELECT 1");
    console.log("Database connected.");
  } catch (err) {
    console.error("Database connection failed", err);
    process.exit(1);
  }

  // Start workers
  try {
    await runNotificationWorker();
    await runAiWorker();
    console.log("Background workers started.");

    // Schedule cron jobs
    cron.schedule("0 2 * * *", () => {
      console.log("Starting nightly CSV sync job...");
      runCsvSyncJob().catch(err => console.error("CSV sync job failed", err));
    });
    console.log("Cron jobs scheduled.");
  } catch (err) {
    console.error("Failed to start workers/cron:", err);
  }

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

main().catch((err) => {
  console.error("Fatal startup error", err);
  process.exit(1);
});
