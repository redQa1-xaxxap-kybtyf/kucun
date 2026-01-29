/**
 * 打印设计器 - 右键菜单
 */

'use client';

import { Copy, Layers, Trash2 } from 'lucide-react';

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

import { useDesignerStore } from '../stores';

interface ElementContextMenuProps {
  elementId: string;
  children: React.ReactNode;
}

export function ElementContextMenu({
  elementId,
  children,
}: ElementContextMenuProps) {
  const duplicateElement = useDesignerStore(s => s.duplicateElement);
  const removeElement = useDesignerStore(s => s.removeElement);
  const bringToFront = useDesignerStore(s => s.bringToFront);
  const sendToBack = useDesignerStore(s => s.sendToBack);
  const copyElement = useDesignerStore(s => s.copyElement);

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={() => copyElement(elementId)}>
          <Copy className="mr-2 h-4 w-4" />
          复制
        </ContextMenuItem>
        <ContextMenuItem onClick={() => duplicateElement(elementId)}>
          <Copy className="mr-2 h-4 w-4" />
          原位复制
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => bringToFront(elementId)}>
          <Layers className="mr-2 h-4 w-4" />
          置于顶层
        </ContextMenuItem>
        <ContextMenuItem onClick={() => sendToBack(elementId)}>
          <Layers className="mr-2 h-4 w-4" />
          置于底层
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem
          className="text-destructive"
          onClick={() => removeElement(elementId)}
        >
          <Trash2 className="mr-2 h-4 w-4" />
          删除
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
