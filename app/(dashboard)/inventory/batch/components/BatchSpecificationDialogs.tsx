'use client';

import dynamic from 'next/dynamic';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  useCreateBatchSpecification,
  useDeleteBatchSpecification,
  useUpdateBatchSpecification,
} from '@/lib/api/batch-specifications';
import type {
  BatchSpecification,
  CreateBatchSpecificationRequest,
} from '@/lib/types/batch-specification';

const BatchSpecificationForm = dynamic(
  () =>
    import('./BatchSpecificationForm').then(mod => mod.BatchSpecificationForm),
  {
    ssr: false,
    loading: () => (
      <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
        表单加载中...
      </div>
    ),
  }
);

export interface BatchSpecificationDialogsProps {
  showForm: boolean;
  setShowForm: (open: boolean) => void;
  formMode: 'create' | 'edit';
  editingSpec: BatchSpecification | null;
  deletingSpec: BatchSpecification | null;
  setDeletingSpec: (spec: BatchSpecification | null) => void;
}

export function BatchSpecificationDialogs({
  showForm,
  setShowForm,
  formMode,
  editingSpec,
  deletingSpec,
  setDeletingSpec,
}: BatchSpecificationDialogsProps) {
  const { toast } = useToast();

  const createMutation = useCreateBatchSpecification();
  const updateMutation = useUpdateBatchSpecification();
  const deleteMutation = useDeleteBatchSpecification();

  const handleFormSubmit = async (values: CreateBatchSpecificationRequest) => {
    try {
      if (formMode === 'create') {
        await createMutation.mutateAsync(values);
        toast({
          title: '创建成功',
          description: '批次资料已创建并同步到库存。',
          variant: 'success',
        });
      } else if (editingSpec) {
        await updateMutation.mutateAsync({
          id: editingSpec.id,
          data: {
            piecesPerUnit: values.piecesPerUnit,
            weight: values.weight,
            thickness: values.thickness,
          },
        });
        toast({
          title: '更新成功',
          description: '批次资料已更新。',
          variant: 'success',
        });
      }
      setShowForm(false);
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : '操作失败，请稍后重试';
      toast({
        title: '操作失败',
        description: message,
        variant: 'destructive',
      });
    }
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingSpec) {
      return;
    }
    try {
      await deleteMutation.mutateAsync(deletingSpec.id);
      toast({
        title: '删除成功',
        description: `批次 ${deletingSpec.batchNumber} 已删除。`,
        variant: 'success',
      });
    } catch (mutationError) {
      const message =
        mutationError instanceof Error
          ? mutationError.message
          : '删除失败，请稍后重试';
      toast({
        title: '删除失败',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setDeletingSpec(null);
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {formMode === 'create' ? '新建批次规格' : '编辑批次规格'}
            </DialogTitle>
            <DialogDescription className="sr-only">
              维护批次资料，保存后会同步到对应库存和产品资料中。
            </DialogDescription>
          </DialogHeader>
          <BatchSpecificationForm
            mode={formMode}
            defaultValues={
              editingSpec
                ? {
                    productId: editingSpec.productId,
                    productName: editingSpec.product?.name,
                    productCode: editingSpec.product?.code,
                    batchNumber: editingSpec.batchNumber,
                    piecesPerUnit: editingSpec.piecesPerUnit,
                    weight: editingSpec.weight ?? undefined,
                    thickness: editingSpec.thickness ?? undefined,
                  }
                : undefined
            }
            onSubmit={handleFormSubmit}
            onCancel={handleFormClose}
            isSubmitting={isSubmitting}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(deletingSpec)}
        onOpenChange={open => {
          if (!open) {
            setDeletingSpec(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除批次规格？</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingSpec
                ? `批次 ${deletingSpec.batchNumber} 删除后，将无法恢复。`
                : '确认删除这条批次资料吗？'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={handleDeleteConfirm}
              disabled={deleteMutation.isPending}
            >
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
