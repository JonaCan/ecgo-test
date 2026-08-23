import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cabinetIdSchema, validationErrorResponse } from "@/lib/validations";

const HOUR_MS = 3_600_000;
/** Full chart window: 24 buckets ending at the current hour. */
const BUCKET_COUNT = 24;

interface HourlyRow {
  /** EXTRACT(EPOCH ...) of the truncated hour; numeric may surface as string. */
  hour_bucket: string | number | bigint;
  count: number;
}

/**
 * GET /api/cabinets/:id/hourly-swaps
 * Swap counts per hour for the last 24 hours, aggregated entirely in
 * PostgreSQL (DATE_TRUNC + GROUP BY). Zero-swap hours are filled in so the
 * client always receives exactly 24 buckets.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const parsed = cabinetIdSchema.safeParse({ id });
    if (!parsed.success) {
      return NextResponse.json(validationErrorResponse(parsed.error), {
        status: 400,
      });
    }
    const cabinetId = parsed.data.id;

    // Aggregation runs in the database; only 24 rows come back.
    // Parameterized via tagged template -> no injection risk.
    const rows = await prisma.$queryRaw<HourlyRow[]>`
      SELECT EXTRACT(EPOCH FROM DATE_TRUNC('hour', created_at)) AS hour_bucket,
             COUNT(*)::int AS count
      FROM swap_transaction
      WHERE cabinet_id = ${cabinetId}
        AND created_at >= DATE_TRUNC('hour', NOW()) - INTERVAL '23 hours'
      GROUP BY 1
      ORDER BY 1
    `;

    // Build the 24-bucket timeline on the global hour grid (TZ-offset safe:
    // any whole-hour timezone truncation lands on the same grid).
    const nowMs = Date.now();
    const startMs =
      Math.floor(nowMs / HOUR_MS) * HOUR_MS - (BUCKET_COUNT - 1) * HOUR_MS;
    const buckets = Array.from({ length: BUCKET_COUNT }, (_, i) => ({
      hour: new Date(startMs + i * HOUR_MS).toISOString(),
      count: 0,
    }));

    for (const row of rows) {
      const index = Math.round(
        (Number(row.hour_bucket) * 1000 - startMs) / HOUR_MS
      );
      if (index >= 0 && index < BUCKET_COUNT) {
        buckets[index].count = Number(row.count);
      }
    }

    return NextResponse.json({ data: buckets });
  } catch (error) {
    console.error("Error fetching hourly swaps:", error);
    return NextResponse.json(
      { error: "Failed to fetch hourly swaps" },
      { status: 500 }
    );
  }
}
