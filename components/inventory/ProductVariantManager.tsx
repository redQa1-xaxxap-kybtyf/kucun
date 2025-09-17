'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit, Eye, Package, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';

import { ProductVariantForm } from '@/components/forms/ProductVariantForm';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ColorCodeDisplay } from '@/components/ui/color-code-display';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { VariantInventorySummary } from './VariantInventorySummary';

import {
    deleteProductVariant,
    getProductVariants,
    productVariantQueryKeys,
} from '@/lib/api/product-variants';
import type { ProductVariant } from '@/lib/types/product';

interface ProductVariantManagerProps {
  productId: string;
  productCode: string;
  productName: string;
  onVariantSelect?: (variant: ProductVariant) => void;
  showInventorySummary?: boolean;
  allowEdit?: boolean;
}

export function ProductVariantManager({
  productId,
  productCode,
  productName,
  onVariantSelect,
  showInventorySummary = true,
  allowEdit = true,
}: ProductVariantManagerProps) {
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);
  const [showInventoryDetail, setShowInventoryDetail] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  // 查询产品变体列表
  const {
    data: variants = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: productVariantQueryKeys.list(productId),
    queryFn: () => getProductVariants(productId),
    enabled: !!productId,
  });

  // 删除变体
  const deleteVariantMutation = useMutation({
    mutationFn: deleteProductVariant,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: productVariantQueryKeys.lists(),
      });
      toast({
        title: '删除成功',
        description: '产品变体已成功删除',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '删除失败',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleVariantClick = (variant: ProductVariant) => {
    setSelectedVariant(variant);
    onVariantSelect?.(variant);
  };

  const handleDeleteVariant = async (variant: ProductVariant) => {
    if (window.confirm(`确定要删除变体 ${variant.colorCode} 吗？`)) {
      deleteVariantMutation.mutate(variant.id);
    }
  };

  const handleEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
  };

  const handleViewInventory = (variantId: string) => {
    setShowInventoryDetail(showInventoryDetail === variantId ? null : variantId);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">
            <Package className="mx-auto h-12 w-12 mb-4" />
            <p>加载产品变体失败</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部操作区 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                产品变体管理
              </CardTitle>
              <CardDescription>
                管理 {productName} ({productCode}) 的色号变体
              </CardDescription>
            </div>
            {allowEdit && (
              <Button
                onClick={() => setShowCreateForm(true)}
                className="flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                添加变体
              </Button>
            )}
          </div>
        </CardHeader>

        {variants.length === 0 ? (
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Package className="mx-auto h-12 w-12 mb-4" />
              <p>暂无产品变体</p>
              <p className="text-sm">点击"添加变体"创建第一个色号变体</p>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <div className="space-y-4">
              {variants.map((variant) => (
                <div key={variant.id} className="space-y-2">
                  {/* 变体基本信息 */}
                  <div
                    className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                      selectedVariant?.id === variant.id
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                    }`}
                    onClick={() => handleVariantClick(variant)}
                  >
                    <div className="flex items-center gap-4">
                      <ColorCodeDisplay
                        colorCode={variant.colorCode}
                        label={variant.colorName || variant.colorCode}
                        size="lg"
                      />
                      <div>
                        <div className="font-medium">{variant.sku}</div>
                        <div className="text-sm text-muted-foreground">
                          {variant.colorName || variant.colorCode}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {/* 库存状态 */}
                      <div className="text-right text-sm">
                        <div className="font-medium">
                          库存: {variant.totalInventory || 0}
                        </div>
                        <div className="text-muted-foreground">
                          可用: {variant.availableInventory || 0}
                        </div>
                      </div>

                      {/* 状态标识 */}
                      <Badge variant={variant.status === 'active' ? 'default' : 'secondary'}>
                        {variant.status === 'active' ? '启用' : '停用'}
                      </Badge>

                      {/* 操作按钮 */}
                      {allowEdit && (
                        <div className="flex items-center gap-1">
                          {showInventorySummary && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleViewInventory(variant.id);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditVariant(variant);
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteVariant(variant);
                            }}
                            disabled={deleteVariantMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 库存详情展开区域 */}
                  {showInventorySummary && showInventoryDetail === variant.id && (
                    <div className="ml-4 border-l-2 border-primary/20 pl-4">
                      <VariantInventorySummary variantId={variant.id} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        )}
      </Card>

      {/* 创建变体表单 */}
      {showCreateForm && (
        <ProductVariantForm
          productId={productId}
          productCode={productCode}
          onSuccess={() => {
            setShowCreateForm(false);
            queryClient.invalidateQueries({
              queryKey: productVariantQueryKeys.lists(),
            });
          }}
          onCancel={() => setShowCreateForm(false)}
        />
      )}

      {/* 编辑变体表单 */}
      {editingVariant && (
        <ProductVariantForm
          productId={productId}
          productCode={productCode}
          variant={editingVariant}
          onSuccess={() => {
            setEditingVariant(null);
            queryClient.invalidateQueries({
              queryKey: productVariantQueryKeys.lists(),
            });
          }}
          onCancel={() => setEditingVariant(null)}
        />
      )}
    </div>
  );
}
