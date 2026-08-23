import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const cabinetId = Number(id);

    const cabinet = await prisma.cabinet.findUnique({
      where: { id: cabinetId },
      include: {
        cabinetLines: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!cabinet) {
      return NextResponse.json({ error: "Cabinet not found" }, { status: 404 });
    }

    return NextResponse.json(cabinet);
  } catch (error) {
    console.error("Error fetching cabinet:", error);
    return NextResponse.json(
      { error: "Failed to fetch cabinet" },
      { status: 500 }
    );
  }
}
