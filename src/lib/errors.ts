// Custom error classes for domain rule violations.
// These let the API layer return proper HTTP status codes:
//   - AuthError       -> 401 Unauthorized (missing or invalid auth headers)
//   - LifecycleError  -> 409 Conflict (action not allowed in current state)
//   - NotFoundError   -> 404 Not Found
//   - ValidationError -> 400 Bad Request (Zod handles most of these)

// Maps to 401 - request is missing required auth headers
export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export class LifecycleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LifecycleError";
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
