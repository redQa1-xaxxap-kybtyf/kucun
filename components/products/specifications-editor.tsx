'use client'

import { Control, useFieldArray } from 'react-hook-form'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Separator } from '@/components/ui/separator'
import { Plus, Minus, Palette, Ruler, Layers } from 'lucide-react'
import { TileSpecifications } from '@/lib/types/product'

interface SpecificationsEditorProps {
  control: Control<any>
  name: string
  disabled?: boolean
}

export function SpecificationsEditor({ control, name, disabled = false }: SpecificationsEditorProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Layers className="h-5 w-5 mr-2" />
          瓷砖规格信息
        </CardTitle>
        <CardDescription>
          配置瓷砖产品的详细规格参数，这些信息将帮助客户更好地了解产品特性
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 基础规格信息 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={control}
            name={`${name}.color`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Palette className="h-4 w-4 mr-1" />
                  颜色
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：米白色、深灰色"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.surface`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>表面处理</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：抛光、哑光、仿古"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.size`}
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center">
                  <Ruler className="h-4 w-4 mr-1" />
                  尺寸规格
                </FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：800×800mm、600×1200mm"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.thickness`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>厚度 (mm)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="如：9.5"
                    step="0.1"
                    min="0"
                    max="100"
                    disabled={disabled}
                    {...field}
                    onChange={(e) => {
                      const value = e.target.value
                      field.onChange(value ? parseFloat(value) : undefined)
                    }}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.pattern`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>花纹</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：木纹、石纹、布纹"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.grade`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>等级</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：优等品、一等品"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.origin`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>产地</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：广东佛山、山东淄博"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={control}
            name={`${name}.series`}
            render={({ field }) => (
              <FormItem>
                <FormLabel>系列</FormLabel>
                <FormControl>
                  <Input
                    placeholder="如：现代简约系列、欧式古典系列"
                    disabled={disabled}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* 规格信息预览 */}
        <SpecificationPreview control={control} name={name} />
      </CardContent>
    </Card>
  )
}

// 规格信息预览组件
function SpecificationPreview({ control, name }: { control: Control<any>, name: string }) {
  const watchedSpecs = control._formValues?.[name.split('.')[0]]?.specifications || {}
  
  const hasSpecs = Object.values(watchedSpecs).some(value => 
    value !== undefined && value !== null && value !== ''
  )

  if (!hasSpecs) {
    return null
  }

  return (
    <div className="space-y-3">
      <Separator />
      <div>
        <h4 className="text-sm font-medium mb-3">规格信息预览</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
          {Object.entries(watchedSpecs).map(([key, value]) => {
            if (!value) return null
            
            const labels: Record<string, string> = {
              color: '颜色',
              surface: '表面处理',
              size: '尺寸规格',
              thickness: '厚度',
              pattern: '花纹',
              grade: '等级',
              origin: '产地',
              series: '系列'
            }

            return (
              <div key={key} className="flex items-center space-x-2">
                <span className="text-muted-foreground">{labels[key] || key}:</span>
                <span className="font-medium">
                  {key === 'thickness' ? `${value}mm` : value}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// 自定义规格字段组件（用于扩展字段）
interface CustomSpecificationFieldProps {
  control: Control<any>
  name: string
  onRemove: () => void
  disabled?: boolean
}

export function CustomSpecificationField({ 
  control, 
  name, 
  onRemove, 
  disabled = false 
}: CustomSpecificationFieldProps) {
  return (
    <div className="flex gap-2 items-end">
      <FormField
        control={control}
        name={`${name}.key`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>字段名</FormLabel>
            <FormControl>
              <Input
                placeholder="如：吸水率、耐磨度"
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name={`${name}.value`}
        render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>字段值</FormLabel>
            <FormControl>
              <Input
                placeholder="如：≤0.5%、4级"
                disabled={disabled}
                {...field}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onRemove}
        disabled={disabled}
        className="mb-2"
      >
        <Minus className="h-4 w-4" />
      </Button>
    </div>
  )
}

// 扩展规格编辑器（支持自定义字段）
interface ExtendedSpecificationsEditorProps extends SpecificationsEditorProps {
  allowCustomFields?: boolean
}

export function ExtendedSpecificationsEditor({ 
  control, 
  name, 
  disabled = false,
  allowCustomFields = false
}: ExtendedSpecificationsEditorProps) {
  const { fields, append, remove } = useFieldArray({
    control,
    name: `${name}.customFields`
  })

  return (
    <div className="space-y-6">
      <SpecificationsEditor control={control} name={name} disabled={disabled} />
      
      {allowCustomFields && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">自定义规格字段</CardTitle>
            <CardDescription>
              添加产品特有的规格参数
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <CustomSpecificationField
                key={field.id}
                control={control}
                name={`${name}.customFields.${index}`}
                onRemove={() => remove(index)}
                disabled={disabled}
              />
            ))}
            
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ key: '', value: '' })}
              disabled={disabled}
            >
              <Plus className="h-4 w-4 mr-2" />
              添加自定义字段
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
