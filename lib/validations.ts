import { z } from "zod";

export const CABINET_STATUSES = ["ONLINE", "OFFLINE", "MAINTENANCE"] as const;

export type CabinetStatus = (typeof CABINET_STATUSES)[number];

/**
 * GET /api/cabinets — query params for list + server-side search,
 * status filter, and pagination.
 *
 * Query params arrive as strings, hence z.coerce; empty values are dropped
 * by searchParamsToObject so `.default()` / `.optional()` behave predictably.
 */
export const listCabinetsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  search: z.string().trim().default(""),
  status: z.enum(CABINET_STATUSES).optional(),
});

/** Dynamic `[id]` segment shared by /api/cabinets/:id sub-routes. */
export const cabinetIdSchema = z.object({
  id: z.coerce.number().int().positive({
    error: "Cabinet id must be a positive integer",
  }),
});

export type ListCabinetsInput = z.infer<typeof listCabinetsSchema>;

/**
 * URLSearchParams -> plain object for Zod parsing.
 * Null/empty values are dropped so optional/default fields kick in cleanly.
 */
export function searchParamsToObject(
  searchParams: URLSearchParams
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of searchParams.entries()) {
    if (value !== "") out[key] = value;
  }
  return out;
}

/**
 * Consistent error payload for failed validation across all routes:
 * { error: "Invalid input", details: [{ path, message }] }
 */
export function validationErrorResponse(error: z.ZodError) {
  return {
    error: "Invalid input",
    details: error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message,
    })),
  };
}
