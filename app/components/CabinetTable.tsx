"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { CABINET_STATUSES } from "@/lib/validations";

const PAGE_SIZE = 10;
const SEARCH_DEBOUNCE_MS = 300;

/** Filter options shown in the UI; "All" clears the status param. */
const STATUS_FILTERS = ["ALL", ...CABINET_STATUSES] as const;

interface Cabinet {
  id: number;
  code: string;
  branch: string;
  status: string;
  last_heartbeat: string | null;
  /** Total battery slots in this cabinet. */
  slotTotal: number;
  /** Slots currently in FULL state (aggregated in the database). */
  slotFull: number;
  /** Swap transactions in the last 24 hours (aggregated in the database). */
  swaps24h: number;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface CabinetTableProps {
  className?: string;
}

interface FetchResult {
  /** Query ("page|search") this payload belongs to, used to detect staleness. */
  key: string;
  data: Cabinet[];
  pagination: Pagination;
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function formatLastPing(lastHeartbeat: string | null): string {
  if (!lastHeartbeat) return "—";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(lastHeartbeat));
}

export function CabinetTable({ className }: CabinetTableProps = {}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // The URL is the single source of truth for page, search, and status filter.
  const page = Math.max(1, Number(searchParams.get("page")) || 1);
  const search = searchParams.get("search") ?? "";
  const status = searchParams.get("status") ?? "";
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const queryKey = `${page}|${debouncedSearch}|${status}`;

  const [result, setResult] = useState<FetchResult | null>(null);
  const [error, setError] = useState<{ key: string; message: string } | null>(
    null
  );

  const updateParams = useCallback(
    (
      updates: Record<string, string | null>,
      method: "replace" | "push" = "replace"
    ) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      }

      const queryString = params.toString();
      const url = queryString ? `${pathname}?${queryString}` : pathname;

      if (method === "push") {
        router.push(url, { scroll: false });
      } else {
        router.replace(url, { scroll: false });
      }
    },
    [pathname, router, searchParams]
  );

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    async function fetchCabinets() {
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (debouncedSearch) {
          params.set("search", debouncedSearch);
        }
        if (status) {
          params.set("status", status);
        }

        const res = await fetch(`/api/cabinets?${params.toString()}`, {
          cache: "no-store",
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error("Failed to fetch cabinets");
        }

        const payload: { data: Cabinet[]; pagination: Pagination } =
          await res.json();

        if (cancelled) return;

        setResult({
          key: queryKey,
          data: payload.data,
          pagination: payload.pagination,
        });

        // Clamp the page if it fell out of range (e.g. filtered results
        // shrank or items were deleted from the last page). Built directly
        // (not via updateParams) so this effect's deps stay stable.
        if (payload.pagination.totalPages < page) {
          const clamped = new URLSearchParams();
          clamped.set("page", String(payload.pagination.totalPages));
          if (debouncedSearch) clamped.set("search", debouncedSearch);
          if (status) clamped.set("status", status);
          const qs = clamped.toString();
          router.replace(qs ? `${pathname}?${qs}` : pathname, {
            scroll: false,
          });
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError({
          key: queryKey,
          message:
            err instanceof Error ? err.message : "An unexpected error occurred",
        });
      }
    }

    fetchCabinets();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [page, debouncedSearch, status, queryKey, pathname, router]);

  const handleRowClick = (cabinetId: number) => {
    router.push(`/cabinets/${cabinetId}`);
  };

  const goToPage = (target: number) => {
    if (
      target < 1 ||
      target > (result?.pagination.totalPages ?? 1) ||
      target === page
    ) {
      return;
    }
    updateParams({ page: String(target) }, "push");
  };

  const hasResultForKey = result?.key === queryKey;
  const busy = !hasResultForKey; // fetching (or waiting to fetch) this query
  const activeError = error?.key === queryKey ? error.message : null;

  if (!result) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-400"></div>
        <span className="ml-3 text-slate-300">Loading cabinets...</span>
      </div>
    );
  }

  if (activeError) {
    return (
      <div className="py-12 text-center text-red-400">Error: {activeError}</div>
    );
  }

  const cabinets = result.data;
  const totalPages = result.pagination.totalPages;
  const total = result.pagination.total;
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  return (
    <div className={`space-y-4 ${className || ""}`}>
      {/* Search + status filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
            />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) =>
              updateParams({ search: e.target.value || null, page: null })
            }
            placeholder="Search by code or branch..."
            aria-label="Search cabinets by code or branch"
            className="w-full sm:max-w-sm rounded-lg border border-slate-700 bg-slate-800 py-2.5 pl-10 pr-4 text-sm text-slate-200 placeholder:text-slate-500 focus:border-green-500/50 focus:outline-none focus:ring-2 focus:ring-green-500/20 transition-colors"
          />
        </div>

        {/* Status filter — synced to the ?status= URL param */}
        <div
          className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 p-1 self-start sm:self-auto"
          role="group"
          aria-label="Filter cabinets by status"
        >
          {STATUS_FILTERS.map((option) => {
            const value = option === "ALL" ? "" : option;
            const active = status === value;
            return (
              <button
                key={option}
                type="button"
                onClick={() => updateParams({ status: value || null, page: null })}
                aria-pressed={active}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  active
                    ? "bg-green-500 text-white shadow"
                    : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div
        className={`overflow-x-auto rounded-xl shadow-xl border border-slate-700 transition-opacity ${
          busy ? "opacity-50 pointer-events-none" : ""
        }`}
      >
        <table className="w-full bg-slate-800">
          <thead>
            <tr className="bg-slate-900 border-b border-slate-700">
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Code
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Branch
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Slots
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Txn (24h)
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-slate-400 uppercase tracking-wider">
                Last Ping
              </th>
            </tr>
          </thead>
          <tbody>
            {hasResultForKey && cabinets.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-6 py-12 text-center text-sm text-slate-400"
                >
                  No cabinets found
                  {search ? ` for "${search}"` : ""}
                  {status ? ` with status ${status}` : ""}.
                </td>
              </tr>
            ) : (
              cabinets.map((cabinet) => {
                return (
                  <tr
                    key={cabinet.id}
                    className="border-b border-slate-700 hover:bg-slate-700/50 cursor-pointer transition-colors"
                    onClick={() => handleRowClick(cabinet.id)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-medium text-white">
                        {cabinet.code}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {cabinet.branch}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                          cabinet.status === "ONLINE"
                            ? "bg-green-900/50 text-green-400 border border-green-500/30"
                            : cabinet.status === "OFFLINE"
                              ? "bg-red-900/50 text-red-400 border border-red-500/30"
                              : "bg-slate-700 text-slate-300 border border-slate-600"
                        }`}
                      >
                        {cabinet.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        <span className="font-medium text-white">
                          {cabinet.slotFull}
                        </span>
                        <span className="text-slate-500"> / </span>
                        <span>{cabinet.slotTotal}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-white">
                        {cabinet.swaps24h}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-300">
                        {formatLastPing(cabinet.last_heartbeat)}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <p className="text-sm text-slate-400">
          Showing{" "}
          <span className="text-slate-200">
            {rangeStart}–{rangeEnd}
          </span>{" "}
          of <span className="text-slate-200">{total}</span> cabinets
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page <= 1 || busy}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
          >
            Previous
          </button>
          <span className="px-2 text-sm text-slate-400">
            Page <span className="text-slate-200">{page}</span> of{" "}
            <span className="text-slate-200">{totalPages}</span>
          </span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages || busy}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 hover:bg-slate-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-slate-800 disabled:hover:text-slate-300 transition-colors"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
