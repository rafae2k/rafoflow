import { systemClock, toIso, type Clock } from "./clock.ts";

/**
 * Structured logger. Every record is one JSON object with a stable `event`
 * slug; errors also carry an `error_slug`. Never log free-form strings.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogFields {
  event: string;
  [key: string]: unknown;
}

export interface LogRecord extends LogFields {
  level: LogLevel;
  time: string;
}

export type LogSink = (record: LogRecord) => void;

export interface Logger {
  debug(fields: LogFields): void;
  info(fields: LogFields): void;
  warn(fields: LogFields): void;
  error(fields: LogFields): void;
  child(base: Record<string, unknown>): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

export const stdoutSink: LogSink = (record) => {
  process.stdout.write(`${JSON.stringify(record)}\n`);
};

export function createMemorySink(): { sink: LogSink; records: LogRecord[] } {
  const records: LogRecord[] = [];
  return { sink: (record) => records.push(record), records };
}

export interface LoggerOptions {
  sink?: LogSink;
  clock?: Clock;
  minLevel?: LogLevel;
  base?: Record<string, unknown>;
}

export function createLogger(options: LoggerOptions = {}): Logger {
  const sink = options.sink ?? stdoutSink;
  const clock = options.clock ?? systemClock;
  const minLevel = options.minLevel ?? "info";
  const base = options.base ?? {};

  const emit = (level: LogLevel, fields: LogFields) => {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    sink({ ...base, ...fields, level, time: toIso(clock.now()) });
  };

  return {
    debug: (f) => emit("debug", f),
    info: (f) => emit("info", f),
    warn: (f) => emit("warn", f),
    error: (f) => emit("error", f),
    child: (extra) => createLogger({ sink, clock, minLevel, base: { ...base, ...extra } }),
  };
}

export const silentLogger: Logger = createLogger({ sink: () => {} });
