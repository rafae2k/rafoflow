# Changelog

- 2026-09-30: job wake-ups use Postgres LISTEN/NOTIFY. Redis was considered and rejected: no new infrastructure to run, and the job volume (about 40 per minute) does not need it. See docs/decisions/0007-job-wakeups.md.
- 2026-09-12: webhook retries use exponential backoff capped at 1 hour.
