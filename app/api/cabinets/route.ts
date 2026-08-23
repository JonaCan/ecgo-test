import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  listCabinetsSchema,
  searchParamsToObject,
  validationErrorResponse,
} from "@/lib/validations";

interface CabinetRow {
  id: number;
  code: string;
  branch: string;
  status: string;
  last_heartbeat: Date | null;
  slot_total: number;
  slot_full: number;
  swap_count_24h: number;
}

/** Escape LIKE wildcards so user input is matched literally. */
function escapeLike(term: string): string {
  return term.replace(/[\\%_]/g, "\\$&");
}

/**
 * GET /api/cabinets — list with server-side search, status filter,
 * DB-level sorting by 24h swap count, and offset pagination.
 *
 * Fully translated to raw SQL: aggregation (slot counts, 24h swaps),
 * ordering, and LIMIT/OFFSET all execute inside PostgreSQL, so only one
 * page of rows ever leaves the database regardless of table size.
 */
export async function GET(request: NextRequest) {
  try {
    const parsed = listCabinetsSchema.safeParse(
      searchParamsToObject(request.nextUrl.searchParams)
    );
    if (!parsed.success) {
      return NextResponse.json(validationErrorResponse(parsed.error), {
        status: 400,
      });
    }
    const { page, limit, search, status } = parsed.data;

    // Composable WHERE fragments — every value stays parameter-bound.
    const conditions = [Prisma.sql`TRUE`];
    if (status) conditions.push(Prisma.sql`c.status = ${status}`);
    if (search) {
      const like = `%${escapeLike(search)}%`;
      conditions.push(
        Prisma.sql`(c.code ILIKE ${like} OR c.branch ILIKE ${like})`
      );
    }
    const whereSql = Prisma.join(conditions, " AND ");

    const offset = (page - 1) * limit;

    // Page rows (sorted by 24h swap count in the database) plus the exact
    // total for pagination metadata, fetched in parallel.
    const [rows, countRows] = await Promise.all([
      prisma.$queryRaw<CabinetRow[]>`
        SELECT
          c.id,
          c.code,
          c.branch,
          c.status,
          c.last_heartbeat,
          COALESCE(l.line_count, 0)::int AS slot_total,
          COALESCE(l.full_count, 0)::int AS slot_full,
          COALESCE(t.swap_count_24h, 0)::int AS swap_count_24h
        FROM cabinet c
        LEFT JOIN (
          SELECT cabinet_id,
                 COUNT(*) AS line_count,
                 COUNT(*) FILTER (WHERE state = 'FULL') AS full_count
          FROM cabinet_line
          GROUP BY cabinet_id
        ) l ON l.cabinet_id = c.id
        LEFT JOIN (
          SELECT cabinet_id, COUNT(*) AS swap_count_24h
          FROM swap_transaction
          WHERE created_at >= NOW() - INTERVAL '24 hours'
          GROUP BY cabinet_id
        ) t ON t.cabinet_id = c.id
        WHERE ${whereSql}
        ORDER BY swap_count_24h DESC, c.id ASC
        LIMIT ${limit} OFFSET ${offset}
      `,
      prisma.$queryRaw<{ total: number }[]>`
        SELECT COUNT(*)::int AS total
        FROM cabinet c
        WHERE ${whereSql}
      `,
    ]);

    return NextResponse.json({
      data: rows.map((row) => ({
        id: row.id,
        code: row.code,
        branch: row.branch,
        status: row.status,
        last_heartbeat: row.last_heartbeat,
        slotTotal: Number(row.slot_total),
        slotFull: Number(row.slot_full),
        swaps24h: Number(row.swap_count_24h),
      })),
      pagination: {
        page,
        limit,
        total: countRows[0]?.total ?? 0,
        totalPages: Math.max(1, Math.ceil((countRows[0]?.total ?? 0) / limit)),
      },
    });
  } catch (error) {
    console.error("Error fetching cabinets:", error);
    return NextResponse.json(
      { error: "Failed to fetch cabinets" },
      { status: 500 }
    );
  }
}
