"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { LogFilters } from "@/components/settings/LogFilters";
import { SystemLogsTable } from "@/components/settings/SystemLogsTable";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import type { SettingsApiResponse, SystemLogFilters, SystemLogListResponse } from "@/lib/types/settings";

export default function LogsPage() {
  const queryClient = useQueryClient();
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

  const clearLogsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/settings/logs?clearAll=true", {
        method: "DELETE",
      });
      if (!response.ok) throw new Error("清空日志失败");
      const result: SettingsApiResponse<{ message: string }> = await response.json();
      if (!result.success) throw new Error(result.error || "清空日志失败");
      return result.data;
    },
    onSuccess: () => {
      toast.success("所有日志已成功清空");
      queryClient.invalidateQueries({ queryKey: ["system-logs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
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
          </div>

          <div className="flex items-center gap-3 lg:ml-0">
             <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="ghost" 
                  className="h-12 rounded-2xl border-none bg-rose-50 font-black text-rose-600 hover:bg-rose-600 hover:text-white transition-all active:scale-95 px-6"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  清空审计日志
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="rounded-3xl border-none shadow-2xl">
                <AlertDialogHeader>
                  <AlertDialogTitle className="text-xl font-black">确定清空所有日志吗？</AlertDialogTitle>
                  <AlertDialogDescription className="font-medium text-slate-500">
                    此操作将永久删除系统内所有的审计记录，删除后将无法通过日志追溯业务操作，请务必谨慎操作。
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="gap-2">
                  <AlertDialogCancel className="rounded-2xl border-slate-100 font-bold">暂不处理</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={() => clearLogsMutation.mutate()}
                    className="rounded-2xl bg-rose-600 font-black hover:bg-rose-700"
                  >
                    确认永久清空
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
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
