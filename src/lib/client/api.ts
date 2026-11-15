import type { ApiError } from "@/lib/domain/types";

export class ApiRequestError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function isApiError(value: unknown): value is ApiError {
  if (typeof value !== "object" || value === null || !("error" in value)) return false;
  const error = (value as { error: unknown }).error;
  return typeof error === "object" && error !== null && "message" in error && "code" in error;
}

/** POSTs JSON and returns the typed body, or throws ApiRequestError with the server's explicit message. */
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiRequestError("network_error", "Could not reach the server. Check your connection and try again.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (isApiError(data)) throw new ApiRequestError(data.error.code, data.error.message);
    throw new ApiRequestError("http_error", `The server returned an unexpected error (${response.status}).`);
  }
  if (data === null) throw new ApiRequestError("invalid_response", "The server returned an empty response.");
  return data as T;
}
