import React from 'react';

/**
 * Reusable, High-Performance Shimmer Skeleton Loaders
 * GPU-accelerated with CSS translate3d, zero reflow, smooth 60fps shimmer
 */

// 1. Grid of Product Cards for PosScreen
export function PosProductGridSkeleton({ count = 12 }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-2 sm:gap-2.5 w-full">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-xl border border-slate-200/80 p-2 flex flex-col justify-between overflow-hidden animate-pulse shadow-2xs"
        >
          <div>
            {/* Image Placeholder */}
            <div className="h-28 sm:h-36 w-full rounded-[10px] bg-slate-200 mb-2 relative overflow-hidden">
              <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.5s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent" />
            </div>
            {/* Title Line */}
            <div className="h-3.5 bg-slate-200 rounded-md w-4/5 mb-1.5" />
            <div className="h-2.5 bg-slate-100 rounded-md w-2/5 mb-2" />
          </div>
          {/* Unit price buttons row */}
          <div className="flex items-center gap-1 pt-1.5 border-t border-slate-100">
            <div className="h-7 bg-slate-100 rounded-lg flex-1" />
            <div className="h-7 bg-slate-100 rounded-lg flex-1" />
            <div className="h-7 bg-teal-100/60 rounded-lg flex-1" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 2. Products Table & Mobile Cards Skeleton for ProductsView
export function ProductsListSkeleton({ count = 8 }) {
  return (
    <div className="space-y-3 w-full">
      {/* Mobile Card Skeleton */}
      <div className="md:hidden flex flex-col gap-3">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-3 animate-pulse"
          >
            <div className="flex items-start justify-between gap-2.5">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-slate-200 shrink-0" />
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="h-4 bg-slate-200 rounded-md w-3/4" />
                  <div className="h-3 bg-slate-100 rounded-md w-1/3" />
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="w-9 h-9 rounded-xl bg-slate-100" />
                <div className="w-9 h-9 rounded-xl bg-slate-100" />
              </div>
            </div>
            <div className="h-8 rounded-xl bg-slate-50 border border-slate-100" />
            <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
              <div className="h-5 bg-slate-100 rounded-md w-20" />
              <div className="h-5 bg-slate-100 rounded-md w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Rows Skeleton */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
              <div className="flex items-center gap-3 w-1/3">
                <div className="w-11 h-11 rounded-xl bg-slate-200 shrink-0" />
                <div className="space-y-1.5 flex-1">
                  <div className="h-3.5 bg-slate-200 rounded-md w-4/5" />
                  <div className="h-2.5 bg-slate-100 rounded-md w-1/2" />
                </div>
              </div>
              <div className="h-6 bg-slate-100 rounded-md w-24" />
              <div className="h-6 bg-slate-100 rounded-md w-28" />
              <div className="h-6 bg-slate-100 rounded-md w-32" />
              <div className="flex items-center gap-1.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100" />
                <div className="w-8 h-8 rounded-lg bg-slate-100" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 3. Transactions / Receipts History Skeleton
export function HistoryListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-3 w-full">
      {/* Mobile Card Skeleton */}
      <div className="md:hidden flex flex-col gap-3">
        {Array.from({ length: count }).map((_, idx) => (
          <div
            key={idx}
            className="p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col gap-2.5 animate-pulse"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 bg-slate-200 rounded-md w-28" />
              <div className="h-5 bg-slate-100 rounded-full w-16" />
            </div>
            <div className="space-y-1 py-1">
              <div className="h-3 bg-slate-100 rounded-md w-1/2" />
              <div className="h-3.5 bg-slate-200 rounded-md w-3/4" />
            </div>
            <div className="h-6 bg-slate-50 rounded-lg flex items-center justify-between px-2">
              <div className="h-3 bg-slate-200 rounded w-16" />
              <div className="h-4 bg-teal-100 rounded w-24" />
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table Rows Skeleton */}
      <div className="hidden md:block bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="divide-y divide-slate-100">
          {Array.from({ length: count }).map((_, idx) => (
            <div key={idx} className="p-3.5 flex items-center justify-between gap-4 animate-pulse">
              <div className="h-4 bg-slate-200 rounded-md w-28" />
              <div className="h-3.5 bg-slate-100 rounded-md w-32" />
              <div className="h-5 bg-slate-100 rounded-full w-20" />
              <div className="h-4 bg-teal-100 rounded-md w-28" />
              <div className="w-16 h-8 rounded-xl bg-slate-100" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 4. Purchases / GRN Orders Skeleton
export function PurchasesListSkeleton({ count = 5 }) {
  return (
    <div className="space-y-3 w-full animate-pulse">
      {Array.from({ length: count }).map((_, idx) => (
        <div
          key={idx}
          className="bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-2xs flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="h-4 bg-slate-200 rounded-md w-32" />
              <div className="h-3 bg-slate-100 rounded-md w-24" />
            </div>
            <div className="h-6 bg-slate-100 rounded-full w-20" />
          </div>
          <div className="h-3.5 bg-slate-100 rounded-md w-1/2" />
          <div className="flex items-center justify-between pt-2 border-t border-slate-100">
            <div className="h-5 bg-teal-100 rounded-md w-28" />
            <div className="h-8 bg-slate-100 rounded-xl w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

// 5. Sales By Unit Report Skeleton
export function SalesByUnitSkeleton({ count = 8 }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden animate-pulse">
      <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="h-4 bg-slate-200 rounded-md w-36" />
        <div className="h-4 bg-slate-200 rounded-md w-28" />
      </div>
      <div className="divide-y divide-slate-100">
        {Array.from({ length: count }).map((_, idx) => (
          <div key={idx} className="p-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 w-1/3">
              <div className="w-9 h-9 rounded-lg bg-slate-200 shrink-0" />
              <div className="space-y-1 flex-1">
                <div className="h-3.5 bg-slate-200 rounded-md w-4/5" />
                <div className="h-2.5 bg-slate-100 rounded-md w-1/2" />
              </div>
            </div>
            <div className="h-6 bg-amber-50 rounded-md w-20" />
            <div className="h-6 bg-sky-50 rounded-md w-20" />
            <div className="h-6 bg-slate-100 rounded-md w-20" />
            <div className="h-4 bg-teal-100 rounded-md w-24" />
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. Dashboard KPI & Charts Skeleton
export function DashboardSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* 4 KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, idx) => (
          <div key={idx} className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-3 bg-slate-200 rounded w-20" />
              <div className="w-7 h-7 rounded-lg bg-slate-100" />
            </div>
            <div className="h-6 bg-slate-200 rounded w-28" />
            <div className="h-3 bg-slate-100 rounded w-16" />
          </div>
        ))}
      </div>
      {/* Chart Box */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs h-64 flex flex-col justify-between">
        <div className="h-4 bg-slate-200 rounded w-36" />
        <div className="h-40 bg-slate-100 rounded-xl w-full" />
      </div>
    </div>
  );
}
