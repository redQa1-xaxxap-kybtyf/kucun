"use client"

import { MapPin } from "lucide-react"
import * as React from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface AddressDisplayProps {
  address?: string | null
  maxWidth?: string
  showIcon?: boolean
  className?: string
}

/**
 * 地址显示组件
 * 支持长地址自动截断和悬停显示完整地址
 */
export function AddressDisplay({
  address,
  maxWidth = "max-w-[200px]",
  showIcon = true,
  className,
}: AddressDisplayProps) {
  if (!address) {
    return (
      <div className={cn("flex items-center gap-2 text-muted-foreground", className)}>
        {showIcon && <MapPin className="h-4 w-4" />}
        <span>-</span>
      </div>
    )
  }

  // 如果地址较短，直接显示
  if (address.length <= 20) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        {showIcon && <MapPin className="h-4 w-4 text-muted-foreground" />}
        <span>{address}</span>
      </div>
    )
  }

  // 长地址使用Tooltip显示完整内容
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center gap-2 cursor-help", className)}>
            {showIcon && <MapPin className="h-4 w-4 text-muted-foreground" />}
            <span className={cn(maxWidth, "truncate")}>
              {address}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs">
          <p className="break-words">{address}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
