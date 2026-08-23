import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { cabinetIdSchema, validationErrorResponse } from "@/lib/validations";

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

    const cabinet = await prisma.cabinet.findUnique({
      where: { id: parsed.data.id },
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
