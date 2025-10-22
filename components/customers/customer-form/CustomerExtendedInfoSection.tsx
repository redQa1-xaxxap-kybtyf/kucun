/* eslint-disable max-lines-per-function */

import { Plus, X } from 'lucide-react';
import type { UseFormReturn } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import type {
  CustomerCreateFormData,
  CustomerUpdateFormData,
} from '@/lib/validations/customer';

type SupportedForm = CustomerCreateFormData | CustomerUpdateFormData;

interface CustomerExtendedInfoSectionProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  isLoading: boolean;
  newTag: string;
  onNewTagChange: (value: string) => void;
  onAddTag: () => void;
  onRemoveTag: (tag: string) => void;
}

export function CustomerExtendedInfoSection({
  form,
  isLoading,
  newTag,
  onNewTagChange,
  onAddTag,
  onRemoveTag,
}: CustomerExtendedInfoSectionProps) {
  // 安全地获取 tags,处理可能的 undefined
  const extendedInfo = form.watch('extendedInfo');
  const tags = (extendedInfo?.tags as string[] | undefined) || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>扩展信息</CardTitle>
        <CardDescription>客户的详细资料和业务信息</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <h4 className="mb-3 text-sm font-medium">联系信息</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              { name: 'extendedInfo.email', label: '邮箱地址', type: 'email' },
              { name: 'extendedInfo.wechat', label: '微信号' },
              { name: 'extendedInfo.fax', label: '传真号码' },
              { name: 'extendedInfo.website', label: '网站地址', type: 'url' },
            ].map(({ name, label, type }) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof SupportedForm}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        type={type}
                        placeholder="请输入"
                        disabled={isLoading}
                        value={(field.value as string) ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 text-sm font-medium">业务信息</h4>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[
              {
                name: 'extendedInfo.industry',
                label: '所属行业',
                placeholder: '如：建材批发',
              },
              {
                name: 'extendedInfo.region',
                label: '所在区域',
                placeholder: '如：华南地区',
              },
            ].map(({ name, label, placeholder }) => (
              <FormField
                key={name}
                control={form.control}
                name={name as keyof SupportedForm}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={placeholder}
                        disabled={isLoading}
                        value={(field.value as string) ?? ''}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        name={field.name}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ))}
          </div>
        </div>

        <Separator />

        <div>
          <h4 className="mb-3 text-sm font-medium">客户标签</h4>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {tags.map(tag => (
                <Badge
                  key={tag}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {tag}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-4 h-auto w-4 p-0"
                    onClick={() => onRemoveTag(tag)}
                    disabled={isLoading}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              ))}
            </div>

            <div className="flex gap-2">
              <Input
                placeholder="添加标签..."
                value={newTag}
                onChange={event => onNewTagChange(event.target.value)}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    onAddTag();
                  }
                }}
                disabled={isLoading}
                className="flex-1"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onAddTag}
                disabled={isLoading || !newTag.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <Separator />

        <FormField
          control={form.control}
          name="extendedInfo.notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>备注信息</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="客户的其他备注信息..."
                  className="min-h-[100px]"
                  disabled={isLoading}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                记录客户的特殊要求、合作历史等信息
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </CardContent>
    </Card>
  );
}
