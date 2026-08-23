import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cabinetIdSchema, validationErrorResponse } from "@/lib/validations";

/** How many of the most recent swaps to return alongside the 24h total. */
const RECENT_LIMIT = 20;

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

    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const where = {
      cabinet_id: cabinetId,
      created_at: { gte: since },
    };

    // Most recent swaps plus the full 24h total, fetched in parallel.
    const [transactions, total] = await Promise.all([
      prisma.swap_transaction.findMany({
        where,
        include: {
          cabinetLine: { select: { order: true } },
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        take: RECENT_LIMIT,
      }),
      prisma.swap_transaction.count({ where }),
    ]);

    return NextResponse.json({ data: transactions, total });
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return NextResponse.json(
      { error: "Failed to fetch transactions" },
      { status: 500 }
    );
  }
}
