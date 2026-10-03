# Renewal reminder service

Sends a reminder to a subscriber before their next charge.

## Invariants

1. Never invent a value you do not know. A missing date is `null`, never "now".
2. Fail loudly on missing configuration. Never send a request with an undefined field.
3. Reminders are deduplicated per subscription per day: the same subscription can get at most one reminder per calendar day (UTC), and a new reminder is allowed the next day.
