import "server-only";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { type ApiError, type ErrorCode, type ReportSource, ReportError } from "@/lib/domain/types";
import { loadFixture } from "./fixtures";

const STATUS: Record<ErrorCode, number> = {
  invalid_request: 400,
  fixture_not_found: 404,
  demographic_conflict: 409,
  missing_patient_name: 422,
  no_results_section: 422,
  no_results_found: 422,
  internal_error: 500,
};

export function errorResponse(code: ErrorCode, message: string): NextResponse<ApiError> {
  return NextResponse.json({ error: { code, message } }, { status: STATUS[code] });
}

/** Parses and validates a JSON body; throws ReportError("invalid_request") with a readable message. */
export async function readBody<T extends z.ZodType>(request: Request, schema: T): Promise<z.infer<T>> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    throw new ReportError("invalid_request", "Request body must be valid JSON.");
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue && issue.path.length > 0 ? `${issue.path.join(".")}: ` : "";
    throw new ReportError("invalid_request", `${where}${issue?.message ?? "Invalid request."}`);
  }
  return parsed.data;
}

export async function markdownFor(source: ReportSource): Promise<string> {
  return "fixtureId" in source ? loadFixture(source.fixtureId) : source.markdown;
}

/** Runs a handler and converts failures to explicit error responses (never success-shaped). */
export async function handle<T>(fn: () => Promise<T>): Promise<NextResponse<T | ApiError>> {
  try {
    return NextResponse.json(await fn());
  } catch (error) {
    if (error instanceof ReportError) return errorResponse(error.code, error.message);
    console.error("Unhandled API error", error);
    return errorResponse("internal_error", "Something went wrong while processing the report.");
  }
}
