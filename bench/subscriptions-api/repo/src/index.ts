import { createApprovingGateway } from "./billing/payment-gateway.ts";
import { openDatabase } from "./db/database.ts";
import { createApp } from "./http/app.ts";
import { createHttpServer } from "./http/server.ts";
import { systemClock } from "./lib/clock.ts";
import { randomIds } from "./lib/ids.ts";
import { createRecordingSender } from "./webhooks/sender.ts";

// Local entry point. Production wiring (real gateway and webhook transport)
// lives in the deployment repo; this one uses the development fakes.
const db = openDatabase(process.env.DATABASE_PATH ?? "subscriptions.db");
const app = createApp({
  db,
  clock: systemClock,
  ids: randomIds,
  gateway: createApprovingGateway(),
  webhookSender: createRecordingSender(),
});

const port = Number(process.env.PORT ?? 3000);
createHttpServer(app).listen(port, () => {
  console.log(`subscriptions-api listening on :${port}`);
});

const RENEWAL_INTERVAL_MS = 60_000;
setInterval(() => {
  app.billing.runDueRenewals().catch((err: unknown) => console.error("renewals failed", err));
  app.dispatchWebhooks().catch((err: unknown) => console.error("webhook dispatch failed", err));
}, RENEWAL_INTERVAL_MS);
