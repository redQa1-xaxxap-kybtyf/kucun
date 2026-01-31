"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle } from "lucide-react";
import dynamic from "next/dynamic";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import type {
  SettingsApiResponse,
  SystemLog,
  SystemLogFilters,
  SystemLogListResponse,
} from "@/lib/types/settings";

type LogFiltersProps = {
  filters: SystemLogFilters;
  onFiltersChange: (filters: SystemLogFilters) => void;
};

type SystemLogsTableProps = {
  logs: SystemLog[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  isLoading?: boolean;
  onPageChange: (page: number) => void;
  onViewDetail?: (log: SystemLog) => void;
};

const LogFilters = dynamic<LogFiltersProps>(
  () => import("@/components/settings/LogFilters").then((mod) => mod.LogFilters),
  {
    ssr: false,
    loading: () => (
      <div className="h-[260px] w-full animate-pulse rounded-[32px] bg-white/40" />
    ),
  }
);

const SystemLogsTable = dynamic<SystemLogsTableProps>(
  () =>
    import("@/components/settings/SystemLogsTable").then(
      (mod) => mod.SystemLogsTable
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col gap-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="h-24 w-full animate-pulse rounded-3xl bg-white/40"
          />
        ))}
      </div>
    ),
  }
);

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [filters, setFilters] = useState<SystemLogFilters>({});

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["system-logs", page, filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
        ...(filters.type && { type: filters.type }),
        ...(filters.level && { level: filters.level }),
        ...(filters.search && { search: filters.search }),
        ...(filters.action && { action: filters.action }),
        ...(filters.startDate && { startDate: filters.startDate }),
        ...(filters.endDate && { endDate: filters.endDate }),
      });

      const response = await fetch(`/api/settings/logs?${searchParams}`);
      if (!response.ok) throw new Error("获取日志失败");
      const result: SettingsApiResponse<SystemLogListResponse> = await response.json();
      if (!result.success) throw new Error(result.error || "获取日志失败");
      return result.data;
    },
  });

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleFiltersChange = (newFilters: SystemLogFilters) => {
    setFilters(newFilters);
    setPage(1);
  };

  return (
    <div className="min-h-screen bg-slate-50/50">
      <div className="mx-auto max-w-[1680px] space-y-12 p-4 lg:p-10 xl:p-14 transition-all duration-500">
        
        {/* Identity Header */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <h2 className="text-3xl font-black tracking-tighter text-slate-900">
              审计日志
            </h2>
            <p className="text-slate-400 text-sm font-bold max-w-2xl leading-relaxed">
               系统自动记录的操作与异常日志数值，用于业务追溯与安全审计。
            </p>
            <p className="text-slate-400 text-sm font-bold max-w-2xl leading-relaxed">
              为保证审计追溯性，已禁用手动清空审计日志。
            </p>
          </div>
        </div>

        {/* Action Matrix (Filters) */}
        <div className="animate-in fade-in duration-700 slide-in-from-top-4">
          <LogFilters filters={filters} onFiltersChange={handleFiltersChange} />
        </div>

        {/* Audit Flow (Content) */}
        <div className="animate-in fade-in-50 duration-1000 slide-in-from-bottom-4">
          {error ? (
            <div className="flex flex-col items-center justify-center rounded-[32px] border border-dashed border-rose-200 bg-rose-50/30 py-20 text-center backdrop-blur-md">
              <AlertCircle className="mb-4 h-12 w-12 text-rose-300" />
              <p className="text-sm font-black uppercase tracking-widest text-rose-500 mb-4">数据同步失败</p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="rounded-xl border-rose-100 font-bold text-rose-600 hover:bg-rose-600 hover:text-white transition-all"
              >
                重试同步
              </Button>
            </div>
          ) : (
            <SystemLogsTable
              logs={data?.logs || []}
              total={data?.total || 0}
              page={page}
              limit={limit}
              totalPages={data?.totalPages || 0}
              isLoading={isLoading}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
    </div>
  );
}
