"use client";

import React from "react";

interface LoadingDashboardProps {
  progress: number;
  stepText: string;
  isPolling?: boolean;
  pollAttempt?: number;
}

export function LoadingDashboard({ progress, stepText, isPolling = false, pollAttempt = 0 }: LoadingDashboardProps) {
  return (
    <div className="w-full flex flex-col gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
      <div className="glass-card p-5 sm:p-6 md:p-8 flex flex-col gap-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 md:gap-8">
          <div className="space-y-2 flex-1">
            <div className="h-6 w-40 rounded-full bg-white/10 animate-pulse" />
            <div className="h-4 w-56 rounded-full bg-white/10 animate-pulse" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="space-y-2">
              <div className="h-3 w-24 rounded-full bg-white/10 animate-pulse" />
              <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-28 rounded-full bg-white/10 animate-pulse" />
              <div className="h-6 w-28 rounded-full bg-white/10 animate-pulse" />
            </div>
            <div className="space-y-2">
              <div className="h-3 w-20 rounded-full bg-white/10 animate-pulse" />
              <div className="h-6 w-24 rounded-full bg-white/10 animate-pulse" />
            </div>
          </div>
        </div>

        <div>
          <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-white/60 transition-all duration-500 ease-out"
              style={{ width: `${Math.max(2, Math.min(100, progress))}%` }}
            />
          </div>
          <p className="text-[11px] text-white/40 mt-2">
            {isPolling ? `Checking result... [attempt ${pollAttempt}]` : stepText}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-8">
        <div className="glass p-5 sm:p-6 md:p-8 rounded-2xl border-white/5 min-h-[280px] md:min-h-[320px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-5 w-40 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-64 rounded-full bg-white/10 animate-pulse" />
          </div>
          <div className="h-40 w-full rounded-2xl bg-white/5 animate-pulse" />
        </div>
        <div className="glass p-5 sm:p-6 md:p-8 rounded-2xl border-white/5 min-h-[280px] md:min-h-[320px] flex flex-col justify-between">
          <div className="space-y-2">
            <div className="h-5 w-44 rounded-full bg-white/10 animate-pulse" />
            <div className="h-3 w-60 rounded-full bg-white/10 animate-pulse" />
          </div>
          <div className="h-40 w-full rounded-2xl bg-white/5 animate-pulse" />
        </div>
      </div>
    </div>
  );
}
