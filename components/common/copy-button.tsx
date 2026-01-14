'use client';

import { Check, Copy } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  iconSize?: 'sm' | 'md' | 'lg';
  onCopy?: () => void;
}

const iconSizeMap = {
  sm: 'h-3 w-3',
  md: 'h-3.5 w-3.5',
  lg: 'h-4 w-4',
};

export function CopyButton({
  text,
  className,
  iconSize = 'sm',
  onCopy,
}: CopyButtonProps) {
  const { toast } = useToast();
  const [copied, setCopied] = React.useState(false);
  const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  // 清理 timeout，防止内存泄漏
  React.useEffect(() => () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }, []);

  const resetCopiedState = React.useCallback(() => {
    // 清除之前的 timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    // 1秒后恢复图标
    timeoutRef.current = setTimeout(() => setCopied(false), 1000);
  }, []);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 防止触发父元素的点击事件

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast({
        title: '复制成功',
        description: `已复制: ${text}`,
        variant: 'default',
      });
      onCopy?.();
      resetCopiedState();
    } catch (_err) {
      // 降级方案:使用旧的 execCommand 方法
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);

        setCopied(true);
        toast({
          title: '复制成功',
          description: `已复制: ${text}`,
          variant: 'default',
        });
        onCopy?.();
        resetCopiedState();
      } catch (_fallbackErr) {
        toast({
          title: '复制失败',
          description: '您的浏览器不支持复制功能',
          variant: 'destructive',
        });
      }
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        'text-muted-foreground hover:text-foreground h-auto p-0.5',
        className
      )}
      onClick={handleCopy}
      type="button"
    >
      {copied ? (
        <Check className={cn(iconSizeMap[iconSize], 'text-green-600')} />
      ) : (
        <Copy className={iconSizeMap[iconSize]} />
      )}
      <span className="sr-only">复制</span>
    </Button>
  );
}
