/**
 * Errors raised while processing an event. Every error carries a stable
 * `errorSlug` (snake_case) that ends up in logs and in the dead-letter table.
 *
 * - RetryableError: transient (warehouse down, dependency not there yet).
 *   The dispatcher retries with backoff, then dead-letters.
 * - PermanentError: the event can never succeed as-is (bad payload).
 *   Dead-lettered on the first failure.
 */
export class PipelineError extends Error {
  readonly errorSlug: string;
  readonly retryable: boolean;

  constructor(errorSlug: string, message: string, retryable: boolean, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = new.target.name;
    this.errorSlug = errorSlug;
    this.retryable = retryable;
  }
}

export class RetryableError extends PipelineError {
  constructor(errorSlug: string, message: string, cause?: unknown) {
    super(errorSlug, message, true, cause);
  }
}

export class PermanentError extends PipelineError {
  constructor(errorSlug: string, message: string, cause?: unknown) {
    super(errorSlug, message, false, cause);
  }
}

export function errorSlugOf(err: unknown): string {
  if (err instanceof PipelineError) return err.errorSlug;
  return "unexpected_error";
}

export function isRetryable(err: unknown): boolean {
  if (err instanceof PipelineError) return err.retryable;
  // Unknown errors are treated as transient: better a few retries than a lost event.
  return true;
}

export function errorMessageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
