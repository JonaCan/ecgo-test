import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const DEFAULT_PAGE_SIZE = 10;
const MAX_PAGE_SIZE = 100;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const page = Math.max(1, Number(searchParams.get("page")) || 1);
    const limit = Math.min(
      MAX_PAGE_SIZE,
      Math.max(1, Number(searchParams.get("limit")) || DEFAULT_PAGE_SIZE)
    );
    const search = searchParams.get("search")?.trim() ?? "";

    const where = search
      ? {
          OR: [
            { code: { contains: search, mode: "insensitive" as const } },
            { branch: { contains: search, mode: "insensitive" as const } },
          ],
        }
      : {};

    // Window for "transactions in the last 24 hours".
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [total, cabinets] = await Promise.all([
      prisma.cabinet.count({ where }),
      prisma.cabinet.findMany({
        where,
        orderBy: { id: "asc" },
        include: {
          _count: {
            select: {
              cabinetLines: true,
              swapTransactions: {
                where: {
                  created_at: { gte: since },
                },
              },
            },
          },
          cabinetLines: {
            select: {
              state: true,
            },
          },
        },
      }),
    ]);

    // Prisma cannot orderBy a *filtered* relation count, so sort in memory
    // (stable sort keeps the id-ascending order for ties) and paginate here.
    cabinets.sort(
      (a, b) => b._count.swapTransactions - a._count.swapTransactions
    );

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      data: cabinets.slice((page - 1) * limit, page * limit),
      pagination: {
        page,
        limit,
        total,
        totalPages,
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
