// 增强的表单输入组件
// 确保受控组件的一致性，防止受控/非受控组件错误

'use client'

import * as React from 'react'
import { Control, FieldPath, FieldValues } from 'react-hook-form'
import { FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface FormInputProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
> {
  control: Control<TFieldValues>
  name: TName
  label?: string
  description?: string
  placeholder?: string
  type?: string
  disabled?: boolean
  className?: string
  required?: boolean
  autoComplete?: string
  maxLength?: number
  icon?: React.ReactNode
}

/**
 * 增强的表单输入组件
 * 
 * 特性：
 * - 自动处理受控组件状态，确保 value 永远不为 undefined
 * - 集成 React Hook Form 和 shadcn/ui Form 组件
 * - 提供一致的错误处理和验证反馈
 * - 支持图标、描述、占位符等常用属性
 * 
 * 使用方式：
 * ```tsx
 * <FormInput
 *   control={form.control}
 *   name="username"
 *   label="用户名"
 *   placeholder="请输入用户名"
 *   required
 * />
 * ```
 */
export function FormInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>({
  control,
  name,
  label,
  description,
  placeholder,
  type = 'text',
  disabled = false,
  className,
  required = false,
  autoComplete,
  maxLength,
  icon,
}: FormInputProps<TFieldValues, TName>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && (
            <FormLabel className={cn(
              "flex items-center gap-2",
              required && "after:content-['*'] after:text-destructive"
            )}>
              {icon}
              {label}
            </FormLabel>
          )}
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              disabled={disabled}
              className={className}
              autoComplete={autoComplete}
              maxLength={maxLength}
              // 确保 value 永远不为 undefined，防止受控/非受控组件错误
              value={field.value ?? ''}
              onChange={(e) => {
                // 对于数字类型，确保传递正确的值类型
                if (type === 'number') {
                  const numValue = e.target.value === '' ? 0 : Number(e.target.value)
                  field.onChange(numValue)
                } else {
                  field.onChange(e.target.value)
                }
              }}
            />
          </FormControl>
          {description && (
            <FormDescription>
              {description}
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}

/**
 * 数字输入组件的特化版本
 * 自动处理数字类型转换和验证
 */
export function FormNumberInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: Omit<FormInputProps<TFieldValues, TName>, 'type'> & {
  min?: number
  max?: number
  step?: number
}) {
  const { min, max, step, ...restProps } = props
  
  return (
    <FormInput
      {...restProps}
      type="number"
      // 为数字输入添加额外的 HTML 属性
      {...(min !== undefined && { min })}
      {...(max !== undefined && { max })}
      {...(step !== undefined && { step })}
    />
  )
}

/**
 * 邮箱输入组件的特化版本
 * 自动设置正确的类型和自动完成属性
 */
export function FormEmailInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: Omit<FormInputProps<TFieldValues, TName>, 'type' | 'autoComplete'>) {
  return (
    <FormInput
      {...props}
      type="email"
      autoComplete="email"
    />
  )
}

/**
 * 密码输入组件的特化版本
 * 自动设置正确的类型和自动完成属性
 */
export function FormPasswordInput<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>
>(props: Omit<FormInputProps<TFieldValues, TName>, 'type' | 'autoComplete'>) {
  return (
    <FormInput
      {...props}
      type="password"
      autoComplete="current-password"
    />
  )
}
