'use client';

import { MapPin } from 'lucide-react';
import React from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface LocationDistributionCardProps {
  locations: Array<{
    location: string;
    quantity: number;
    reservedQuantity: number;
    availableQuantity: number;
    batches: number;
  }>;
}

export function LocationDistributionCard({
  locations,
}: LocationDistributionCardProps) {
  if (locations.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MapPin className="h-4 w-4" />
          存储位置分布
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {locations.map((location, index: number) => (
            <div key={index} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-primary" />
                <span className="font-medium">{location.location}</span>
              </div>
              <div className="text-right">
                <div className="font-medium">{location.quantity}</div>
                <div className="text-xs text-muted-foreground">
                  {location.batches} 批次
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
