"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface CabinetLine {
  id: number;
  order: number;
  state: string;
  soc_battery: number;
}

interface SwapTransaction {
  id: string;
  swap_type: string;
  created_at: string;
  cabinetLine: {
    order: number;
  };
}

interface TransactionsResponse {
  data: SwapTransaction[];
  /** Total swaps for this cabinet in the last 24 hours. */
  total: number;
}

interface HourlyBucket {
  /** ISO timestamp of the bucket start (top of the hour). */
  hour: string;
  count: number;
}

interface HourlySwapsResponse {
  data: HourlyBucket[];
}

interface Cabinet {
  id: number;
  code: string;
  branch: string;
  status: string;
  cabinetLines: CabinetLine[];
}

interface CabinetGridProps {
  cabinetId: number;
  className?: string;
}

function getStatusConfig(state: string) {
  switch (state) {
    case "EMPTY":
      return {
        label: "EMPTY",
        bg: "bg-slate-700",
        border: "border-slate-600",
        text: "text-slate-400",
        icon: "text-slate-500",
        glow: "",
      };
    case "CHARGING":
      return {
        label: "CHARGING",
        bg: "bg-blue-900/50",
        border: "border-blue-500",
        text: "text-blue-400",
        icon: "text-blue-400",
        glow: "shadow-[0_0_15px_rgba(59,130,246,0.3)]",
      };
    case "FULL":
      return {
        label: "FULL",
        bg: "bg-green-900/50",
        border: "border-green-500",
        text: "text-green-400",
        icon: "text-green-400",
        glow: "shadow-[0_0_15px_rgba(34,197,94,0.3)]",
      };
    case "LOCKED":
      return {
        label: "LOCKED",
        bg: "bg-amber-900/50",
        border: "border-amber-500",
        text: "text-amber-400",
        icon: "text-amber-400",
        glow: "shadow-[0_0_15px_rgba(245,158,11,0.3)]",
      };
    case "FAULT":
      return {
        label: "FAULT",
        bg: "bg-red-900/50",
        border: "border-red-500",
        text: "text-red-400",
        icon: "text-red-400",
        glow: "shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse",
      };
    default:
      return {
        label: "UNKNOWN",
        bg: "bg-slate-800",
        border: "border-slate-600",
        text: "text-slate-400",
        icon: "text-slate-500",
        glow: "",
      };
  }
}

function BatteryIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
      <line x1="23" y1="10" x2="23" y2="14" />
    </svg>
  );
}

function BatteryFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1" y="6" width="18" height="12" rx="2" ry="2" />
      <rect x="4" y="9" width="12" height="6" rx="1" fill="currentColor" opacity="0.3" />
      <line x1="23" y1="10" x2="23" y2="14" />
    </svg>
  );
}

function formatTxnTime(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(iso));
}

/** "14:00" style label for a bucket start. */
function formatHourLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

interface ChartPoint {
  /** "14:00" — used as the x-axis label and tooltip title. */
  label: string;
  count: number;
}

/** Dark-themed tooltip matching the dashboard's slate/green palette. */
function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: ChartPoint }[];
}) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point) return null;
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-950/95 px-3 py-1.5 text-xs font-mono text-slate-200 shadow-xl">
      {point.label} · {point.count} swaps
    </div>
  );
}

/**
 * Hourly swap bar chart powered by Recharts.
 * One bar per hourly bucket; the API always returns exactly 24 buckets.
 */
function HourlySwapsChart({
  buckets,
  loading,
  error,
}: {
  buckets: HourlyBucket[];
  loading: boolean;
  error: string | null;
}) {
  const data: ChartPoint[] = buckets.map((b) => ({
    label: formatHourLabel(b.hour),
    count: b.count,
  }));
  const hasActivity = data.some((d) => d.count > 0);

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
      {/* Chart header */}
      <div className="bg-slate-900 px-5 py-4 border-b border-slate-700">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white">Swaps per Hour</h2>
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
            Last 24 Hours
          </span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-slate-300">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-400"></div>
          <span className="ml-3">Loading chart...</span>
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400">Error: {error}</div>
      ) : !hasActivity ? (
        <div className="py-12 text-center text-sm text-slate-400">
          No swap activity in the last 24 hours.
        </div>
      ) : (
        <div className="p-4 pt-6 pr-2">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid vertical={false} stroke="#334155" strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
                tickLine={false}
                axisLine={{ stroke: "#475569" }}
                interval={2}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: "#64748b", fontSize: 10, fontFamily: "var(--font-geist-mono)" }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(148,163,184,0.08)" }} />
              <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

export function CabinetGrid({ cabinetId, className }: CabinetGridProps) {
  const [cabinet, setCabinet] = useState<Cabinet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<SwapTransaction[]>([]);
  const [txnTotal, setTxnTotal] = useState(0);
  const [txnLoading, setTxnLoading] = useState(true);
  const [txnError, setTxnError] = useState<string | null>(null);
  const [hourlyBuckets, setHourlyBuckets] = useState<HourlyBucket[]>([]);
  const [hourlyLoading, setHourlyLoading] = useState(true);
  const [hourlyError, setHourlyError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchCabinet() {
      setLoading(true);
      try {
        const res = await fetch(`/api/cabinets/${cabinetId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to fetch cabinet");
        const data = await res.json();
        setCabinet(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An unexpected error occurred");
      } finally {
        setLoading(false);
      }
    }
    fetchCabinet();
  }, [cabinetId]);

  useEffect(() => {
    async function fetchTransactions() {
      setTxnLoading(true);
      setTxnError(null);
      try {
        const res = await fetch(`/api/cabinets/${cabinetId}/transactions`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch transactions");
        const json: TransactionsResponse = await res.json();
        setTransactions(json.data);
        setTxnTotal(json.total);
      } catch (err) {
        setTxnError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setTxnLoading(false);
      }
    }
    fetchTransactions();
  }, [cabinetId]);

  useEffect(() => {
    async function fetchHourlySwaps() {
      setHourlyLoading(true);
      setHourlyError(null);
      try {
        const res = await fetch(`/api/cabinets/${cabinetId}/hourly-swaps`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error("Failed to fetch hourly swaps");
        const json: HourlySwapsResponse = await res.json();
        setHourlyBuckets(json.data);
      } catch (err) {
        setHourlyError(
          err instanceof Error ? err.message : "An unexpected error occurred"
        );
      } finally {
        setHourlyLoading(false);
      }
    }
    fetchHourlySwaps();
  }, [cabinetId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        <span className="ml-3 text-slate-300">Loading cabinet...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-red-400">Error: {error}</div>
      </div>
    );
  }

  if (!cabinet) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="text-center text-slate-400">No cabinet found</div>
      </div>
    );
  }

  const lines = cabinet.cabinetLines;
  const outCount = transactions.filter((t) => t.swap_type === "OUT").length;
  const inCount = transactions.filter((t) => t.swap_type === "IN").length;

  return (
    <div className={`min-h-screen bg-slate-900 ${className || ""}`}>
      <div className="max-w-7xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link
            href="/"
            className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-2 mb-4"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </Link>
        </div>

        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Left Column: Cabinet Frame */}
          <div className="w-full lg:w-lg lg:shrink-0">
            {/* Cabinet Frame */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden">
              {/* Cabinet Code - Centered Header */}
              <div className="bg-slate-900 py-6 text-center border-b border-slate-700">
                <h1 className="text-3xl font-bold text-white tracking-wider">{cabinet.code}</h1>
                <p className="text-slate-400 text-sm mt-1">{cabinet.branch} • {cabinet.status}</p>
              </div>

              {/* Legend */}
              <div className="flex items-center justify-center gap-4 py-3 border-b border-slate-700 text-[10px] text-slate-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400"></span> FULL</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400"></span> CHARGING</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-500"></span> EMPTY</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400"></span> LOCKED</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400"></span> FAULT</span>
              </div>

              {/* Battery Slots Grid - 3 columns, square cells */}
              <div className="p-4">
                <div className="grid grid-cols-3 gap-3">
                  {lines.map((line) => {
                    const config = getStatusConfig(line.state);
                    const isCharging = line.state === "CHARGING";
                    const isFull = line.state === "FULL";
                    const isFault = line.state === "FAULT";

                    return (
                      <div
                        key={line.id}
                        className={`
                          relative rounded-xl border-2 ${config.border} ${config.bg} ${config.glow}
                          aspect-square flex flex-col items-center justify-center
                          transition-all duration-300 hover:scale-[1.02]
                        `}
                      >
                        {/* Slot Number - Top Left */}
                        <div className="absolute top-2 left-2">
                          <span className="text-[10px] font-mono text-slate-500">
                            {String(line.order).padStart(2, "0")}
                          </span>
                        </div>

                        {/* Status - Top Right */}
                        <div className="absolute top-2 right-2">
                          <span className={`text-[9px] font-bold uppercase tracking-wider ${config.text} ${isFault ? "animate-pulse" : ""}`}>
                            {config.label}
                          </span>
                        </div>

                        {/* Battery Icon - Center */}
                        <div className="flex flex-col items-center justify-center">
                          {isFull || isCharging ? (
                            <BatteryFilledIcon className={`w-10 h-10 ${config.icon}`} />
                          ) : (
                            <BatteryIcon className={`w-10 h-10 ${config.icon}`} />
                          )}

                          {/* Charging Animation */}
                          {isCharging && (
                            <div className="mt-1 flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "0ms" }}></div>
                              <div className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "150ms" }}></div>
                              <div className="w-1 h-1 rounded-full bg-blue-400 animate-bounce" style={{ animationDelay: "300ms" }}></div>
                            </div>
                          )}

                          {/* State of Charge */}
                          {isCharging && line.soc_battery != null && (
                            <span className="mt-1 text-[11px] font-mono font-bold text-blue-400">
                              {line.soc_battery}%
                            </span>
                          )}

                          {/* Full Checkmark */}
                          {isFull && (
                            <svg className="w-4 h-4 text-green-400 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          )}

                          {/* Fault Warning */}
                          {isFault && (
                            <svg className="w-4 h-4 text-red-400 mt-1 animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Cabinet Footer */}
              <div className="px-4 py-3 border-t border-slate-700 flex items-center justify-between text-xs text-slate-500">
                <span>{lines.length} Slots</span>
                <span className="font-mono text-[10px]">ECGO POWER SYSTEMS</span>
              </div>
            </div>
          </div>

          {/* Right Column: Hourly chart + Swap Transactions (latest 20 of last 24 hours) */}
          <div className="w-full lg:flex-1 min-w-0 space-y-6">
            <HourlySwapsChart
              buckets={hourlyBuckets}
              loading={hourlyLoading}
              error={hourlyError}
            />

            <div className="bg-slate-800 rounded-2xl border border-slate-700 shadow-2xl overflow-hidden flex flex-col">
              {/* Panel Header */}
              <div className="bg-slate-900 px-5 py-4 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white">Swap Transactions</h2>
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-500">
                    Last 24 Hours
                  </span>
                </div>
                {!txnLoading && !txnError && (
                  <div className="mt-2 flex items-center gap-2 text-[10px] font-mono">
                    <span className="px-2 py-0.5 rounded-full bg-green-900/50 border border-green-500/30 text-green-400">
                      {inCount} IN
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-red-900/50 border border-red-500/30 text-red-400">
                      {outCount} OUT
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-slate-300">
                      {txnTotal} TOTAL
                    </span>
                    {txnTotal > transactions.length && (
                      <span className="text-slate-500">
                        showing latest {transactions.length}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Transactions Table - scrollable */}
              <div className="overflow-y-auto max-h-[65vh]">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-slate-900">
                    <tr className="border-b border-slate-700">
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Slot
                      </th>
                      <th className="px-5 py-3 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                        Type
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {txnLoading ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center">
                          <div className="inline-flex items-center gap-3 text-slate-300">
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-green-400"></div>
                            Loading transactions...
                          </div>
                        </td>
                      </tr>
                    ) : txnError ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-red-400">
                          Error: {txnError}
                        </td>
                      </tr>
                    ) : transactions.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-5 py-12 text-center text-slate-400">
                          No transactions in the last 24 hours.
                        </td>
                      </tr>
                    ) : (
                      transactions.map((txn) => {
                        const isIn = txn.swap_type === "IN";
                        return (
                          <tr
                            key={txn.id}
                            className="border-b border-slate-700/60 hover:bg-slate-700/40 transition-colors"
                          >
                            <td className="px-5 py-3 whitespace-nowrap font-mono text-xs text-slate-300">
                              {formatTxnTime(txn.created_at)}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap font-mono text-xs text-slate-400">
                              {String(txn.cabinetLine.order).padStart(2, "0")}
                            </td>
                            <td className="px-5 py-3 whitespace-nowrap">
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                                  isIn
                                    ? "bg-green-900/50 text-green-400 border border-green-500/30"
                                    : "bg-red-900/50 text-red-400 border border-red-500/30"
                                }`}
                              >
                                {txn.swap_type}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
