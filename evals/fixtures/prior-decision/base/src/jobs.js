export function wakeWorkers(db) {
  return db.query("NOTIFY job_ready");
}
