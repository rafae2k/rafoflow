# subscriptions-api

Subscription billing API: customers, plans, subscriptions (active / paused / canceled / past_due), charges, an append-only event log and webhook deliveries.

```bash
npm install
npm test
npm run typecheck
node src/index.ts   # listens on :3000, stores data in ./subscriptions.db
```

Docs:

- [HTTP API](docs/api.md)
- [Billing rules](docs/billing.md)
- [Domain events and webhooks](docs/events.md)

Rules for contributors (human or agent) are in [AGENTS.md](AGENTS.md).
