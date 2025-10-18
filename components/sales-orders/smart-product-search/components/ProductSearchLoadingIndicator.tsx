import { Loader2 } from 'lucide-react';

export function ProductSearchLoadingIndicator() {
  return (
    <div className="text-muted-foreground flex items-center justify-center gap-2 py-3 text-xs">
      <Loader2 className="h-4 w-4 animate-spin" />
      正在搜索...
    </div>
  );
}
