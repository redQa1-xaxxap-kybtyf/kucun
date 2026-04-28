import { Building2 } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { CustomerSelector } from '@/components/customers/customer-hierarchy';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import type {
  CustomerCreateFormData,
  CustomerUpdateFormData,
} from '@/lib/validations/customer';

// 使用更宽松的类型定义,支持两种表单类型
type _SupportedForm = CustomerCreateFormData | CustomerUpdateFormData;

interface CustomerBasicInfoSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isLoading: boolean;
  excludeCustomerId?: string;
}

export function CustomerBasicInfoSection({
  form,
  isLoading,
  excludeCustomerId,
}: CustomerBasicInfoSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Building2 className="mr-2 h-5 w-5" />
          基础信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>客户名称 *</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：广州瓷砖批发市场"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>联系电话</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：13800138000"
                    disabled={isLoading}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>客户地址</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="客户的详细地址..."
                  className="min-h-[80px]"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <CustomerSelector
          control={form.control}
          name="parentCustomerId"
          label="上级客户"
          placeholder="选择上级客户（可选）"
          disabled={isLoading}
          excludeId={excludeCustomerId}
          onlyParents={false}
        />
      </CardContent>
    </Card>
  );
}
