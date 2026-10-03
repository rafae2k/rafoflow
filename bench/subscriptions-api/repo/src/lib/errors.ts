/**
 * Application errors. Every error that should reach the client as a
 * structured response extends AppError; anything else becomes a 500.
 */
export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(400, "validation_error", message, details);
  }
}

export class NotFoundError extends AppError {
  constructor(entity: string, id: string) {
    super(404, "not_found", `${entity} ${id} not found`);
  }
}

export class ConflictError extends AppError {
  constructor(code: string, message: string) {
    super(409, code, message);
  }
}

export class PaymentFailedError extends AppError {
  constructor(message: string) {
    super(402, "payment_failed", message);
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}
