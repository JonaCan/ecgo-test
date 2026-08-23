import { Suspense } from "react";
import { CabinetTable } from "@/app/components/CabinetTable";

function CabinetTableFallback() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
      <span className="ml-3 text-slate-300">Loading cabinets...</span>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-slate-900">
      <div className="max-w-6xl mx-auto p-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-green-500 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white">ECGO Power Systems</h1>
          </div>
          <p className="text-slate-400">Battery Swap Station Management</p>
        </div>

        {/* Cabinets Table */}
        <Suspense fallback={<CabinetTableFallback />}>
          <CabinetTable />
        </Suspense>
      </div>
    </div>
  );
}
