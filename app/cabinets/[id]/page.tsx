"use client";

import { CabinetGrid } from "@/app/components/CabinetGrid";
import { use } from "react";

export default function CabinetPage({ params }: { params : Promise<{ id: string }> }) {
  const { id } = use(params)
  const cabinetId = Number(id)

  return (
    <div>
      <CabinetGrid cabinetId={cabinetId} />
    </div>
  );
}
