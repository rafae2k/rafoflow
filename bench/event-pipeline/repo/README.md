# event-pipeline

Processes order and shipment events from our e-commerce vendor, keeps a canonical copy of each order in SQLite, and sends paid orders to the warehouse.

```
vendor webhook ──ingest──▶ queue ──drain──▶ processMessage ──▶ handler ──▶ SQLite (orders, items, shipments)
                             ▲                                    │
reconciliation ──publish─────┘                                    └──▶ maybeDispatch ──▶ warehouse
```

## Quick start

```bash
npm install
npm test
npm run typecheck
```

```ts
import {
  createPipeline,
  openDatabase,
  FakeWarehouse,
  systemClock,
} from "./src/index.ts";

const pipeline = createPipeline({
  db: openDatabase("orders.db"),
  warehouse: new FakeWarehouse(),
  clock: systemClock,
});
pipeline.ingest(webhookBody); // throws on invalid input
await pipeline.drain();
```

## Docs

- [docs/event-flow.md](docs/event-flow.md) — envelope, queue, dedup, retries, handlers
- [docs/fulfillment.md](docs/fulfillment.md) — when and how orders go to the warehouse
- [docs/reconciliation.md](docs/reconciliation.md) — the safety-net sweep

Rules every change must keep are in [AGENTS.md](AGENTS.md).
