export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function forbidden(message = "Forbidden"): HttpError {
  return new HttpError(403, message, "FORBIDDEN");
}

export function unauthorized(message = "Unauthorized"): HttpError {
  return new HttpError(401, message, "UNAUTHORIZED");
}

export function notFound(message = "Not found"): HttpError {
  return new HttpError(404, message, "NOT_FOUND");
}

export function badRequest(message: string, code?: string): HttpError {
  return new HttpError(400, message, code);
}

export function planLimitReached(): HttpError {
  return new HttpError(402, "Plan limit reached", "PLAN_LIMIT_REACHED");
}

/** Serialize an error to a JSON-safe response body */
export function errorResponse(err: unknown): { error: string; code?: string } {
  if (err instanceof HttpError) {
    return { error: err.message, code: err.code };
  }
  return { error: "Internal server error" };
}

/** Get HTTP status code from an error */
export function statusFor(err: unknown): number {
  if (err instanceof HttpError) return err.status;
  return 500;
}
