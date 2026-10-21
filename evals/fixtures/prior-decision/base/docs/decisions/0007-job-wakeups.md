# 0007 — Job wake-ups

Status: decided, 2026-09-30.

Workers wake up through Postgres LISTEN/NOTIFY. Redis pub/sub was rejected: it adds a service to run and monitor for a volume the database handles. Revisit only if volume passes 10x.
