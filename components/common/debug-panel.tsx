'use client';

import { Bug, X } from 'lucide-react';
import { useState, useEffect } from 'react';

import { Button } from '@/components/ui/button';
import { logger } from '@/lib/utils/console-logger';

interface DebugLog {
  timestamp: string;
  type: 'log' | 'error' | 'warn' | 'info';
  message: string;
  data?: ReadonlyArray<unknown>;
}

/**
 * 调试面板组件
 * 捕获并显示控制台日志
 */
export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<DebugLog[]>([]);

  useEffect(() => {
    // 只在开发环境启用
    if (process.env.NODE_ENV !== 'development') {
      return;
    }

    // 保存原始的 logger 方法
    const originalDebug = logger.debug.bind(logger) as typeof logger.debug;
    const originalInfo = logger.info.bind(logger) as typeof logger.info;
    const originalWarn = logger.warn.bind(logger) as typeof logger.warn;
    const originalError = logger.error.bind(logger) as typeof logger.error;

    // 添加日志的辅助函数
    const addLog = (type: DebugLog['type'], args: ReadonlyArray<unknown>) => {
      const timestamp = new Date().toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        fractionalSecondDigits: 3,
      });

      const message = args
        .map(arg => {
          if (typeof arg === 'object' && arg !== null) {
            try {
              return JSON.stringify(arg, null, 2);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      setLogs(prev => [
        ...prev.slice(-99), // 保留最近100条
        { timestamp, type, message, data: args },
      ]);
    };

    const wrapLogger =
      <T extends DebugLog['type'], Fn extends (...args: any[]) => void>(
        level: T,
        original: Fn
      ) =>
      (...args: Parameters<Fn>) => {
        original(...args);
        addLog(level, args);
      };

    logger.debug = wrapLogger('log', originalDebug) as typeof logger.debug;
    logger.info = wrapLogger('info', originalInfo) as typeof logger.info;
    logger.warn = wrapLogger('warn', originalWarn) as typeof logger.warn;
    logger.error = wrapLogger('error', originalError) as typeof logger.error;

    // 清理函数
    return () => {
      logger.debug = originalDebug;
      logger.info = originalInfo;
      logger.warn = originalWarn;
      logger.error = originalError;
    };
  }, []);

  // 只在开发环境显示
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const getLogColor = (type: DebugLog['type']) => {
    switch (type) {
      case 'error':
        return 'text-red-600 bg-red-50';
      case 'warn':
        return 'text-yellow-600 bg-yellow-50';
      case 'info':
        return 'text-blue-600 bg-blue-50';
      default:
        return 'text-gray-700 bg-gray-50';
    }
  };

  return (
    <>
      {/* 浮动按钮 */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed right-4 bottom-4 z-50 h-12 w-12 rounded-full p-0 shadow-lg"
        variant={logs.some(l => l.type === 'error') ? 'destructive' : 'default'}
      >
        <Bug className="h-5 w-5" />
        {logs.length > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs text-white">
            {logs.length}
          </span>
        )}
      </Button>

      {/* 调试面板 */}
      {isOpen && (
        <div className="fixed right-4 bottom-20 z-50 flex h-96 w-[600px] flex-col rounded-lg border bg-white shadow-2xl">
          {/* 头部 */}
          <div className="flex items-center justify-between border-b bg-gray-100 px-4 py-2">
            <div className="flex items-center gap-2">
              <Bug className="h-4 w-4" />
              <span className="font-semibold">调试面板</span>
              <span className="text-xs text-gray-500">
                ({logs.length} 条日志)
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLogs([])}
                className="h-7 text-xs"
              >
                清空
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsOpen(false)}
                className="h-7 w-7 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 日志内容 */}
          <div className="flex-1 overflow-y-auto p-2">
            {logs.length === 0 ? (
              <div className="flex h-full items-center justify-center text-gray-400">
                暂无日志
              </div>
            ) : (
              <div className="space-y-1">
                {logs.map((log, index) => (
                  <div
                    key={index}
                    className={`rounded p-2 font-mono text-xs ${getLogColor(log.type)}`}
                  >
                    <div className="mb-1 flex items-center gap-2">
                      <span className="font-bold">
                        {log.type.toUpperCase()}
                      </span>
                      <span className="text-gray-500">{log.timestamp}</span>
                    </div>
                    <pre className="break-all whitespace-pre-wrap">
                      {log.message}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 底部提示 */}
          <div className="border-t bg-gray-50 px-4 py-2 text-xs text-gray-500">
            💡 提示：所有日志也会显示在浏览器控制台中
          </div>
        </div>
      )}
    </>
  );
}
