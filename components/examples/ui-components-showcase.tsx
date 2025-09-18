// UI组件库展示示例
// 展示所有自定义组件的使用方法和效果

'use client';

import * as React from 'react';

import { Button } from '@/components/ui/button';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';

// 瓷砖行业特色组件
import {
    ColorCodeDisplay,
    ColorCodeGrid,
    ColorCodeSelector,
} from '@/components/ui/color-code-display';
import {
    InventoryHealth,
    InventoryStatusIndicator,
    QuickStatusToggle,
    type InventoryStatus,
} from '@/components/ui/inventory-status-indicator';

// 移动端优化组件
import {
    MobileDataTable,
    createDateColumn,
    createTextColumn,
    type ColumnDef
} from '@/components/ui/mobile-data-table';
import {
    MobileSearchBar,
    type FilterOption,
    type SearchState,
    type SortOption,
} from '@/components/ui/mobile-search-bar';

import { Separator } from '@/components/ui/separator';
import {
    SpecificationDisplay,
    type TileSpecification
} from '@/components/ui/specification-display';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// 示例数据
const sampleSpecification: TileSpecification = {
  length: 600,
  width: 600,
  thickness: 10,
  surface: 'polished',
  grade: 'AAA',
  waterAbsorption: 0.5,
  slipResistance: 'R10',
  wearResistance: 'PEI4',
  frostResistance: true,
  weight: 25,
  packingQuantity: 4,
  coverageArea: 1.44,
};



const sampleProducts = [
  {
    id: '1',
    name: '抛光砖600x600',
    code: 'PG-600-001',
    colorCode: 'W001',
    stock: 150,
    safetyStock: 100,
    status: 'in_stock' as InventoryStatus,
    createdAt: '2024-01-15',
  },
  {
    id: '2',
    name: '仿古砖300x300',
    code: 'FG-300-002',
    colorCode: 'BR002',
    stock: 50,
    safetyStock: 100,
    status: 'low_stock' as InventoryStatus,
    createdAt: '2024-01-14',
  },
  {
    id: '3',
    name: '大理石纹800x800',
    code: 'DL-800-003',
    colorCode: 'G003',
    stock: 0,
    safetyStock: 50,
    status: 'out_of_stock' as InventoryStatus,
    createdAt: '2024-01-13',
  },
];

export default function UIComponentsShowcase() {
  // 状态管理
  const [selectedColorCode, setSelectedColorCode] = React.useState('W001');
  const [productionDate, setProductionDate] = React.useState('2024-01-15');
  const [inventoryStatus, setInventoryStatus] =
    React.useState<InventoryStatus>('in_stock');
  const [searchState, setSearchState] = React.useState<SearchState>({
    keyword: '',
    filters: {},
    sort: undefined,
  });

  // 表格列定义
  const columns: ColumnDef<(typeof sampleProducts)[0]>[] = [
    createTextColumn('name', '产品名称', { mobilePrimary: true }),
    createTextColumn('code', '产品编码', { mobileLabel: '编码' }),
    {
      key: 'colorCode',
      title: '色号',
      render: value => <ColorCodeDisplay colorCode={value} size="sm" />,
      mobileLabel: '色号',
    },
    {
      key: 'status',
      title: '库存状态',
      render: (value, record) => (
        <InventoryStatusIndicator
          status={value}
          currentStock={record.stock}
          safetyStock={record.safetyStock}
          size="sm"
        />
      ),
      mobileLabel: '状态',
    },
    createDateColumn('createdAt', '创建时间', undefined, {
      mobileHidden: true,
    }),
  ];

  // 筛选选项
  const filterOptions: FilterOption[] = [
    {
      key: 'status',
      label: '库存状态',
      type: 'select',
      options: [
        { value: 'in_stock', label: '有库存' },
        { value: 'low_stock', label: '库存不足' },
        { value: 'out_of_stock', label: '缺货' },
      ],
    },
    {
      key: 'minStock',
      label: '最小库存',
      type: 'number',
      placeholder: '输入最小库存数量',
    },
  ];

  // 排序选项
  const sortOptions: SortOption[] = [
    { key: 'name', label: '产品名称' },
    { key: 'stock', label: '库存数量' },
    { key: 'createdAt', label: '创建时间' },
  ];

  return (
    <div className="container mx-auto space-y-8 py-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold">UI组件库展示</h1>
        <p className="text-muted-foreground">
          瓷砖行业特色组件和移动端优化组件的使用示例
        </p>
      </div>

      <Tabs defaultValue="tile-components" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="tile-components">瓷砖特色组件</TabsTrigger>
          <TabsTrigger value="mobile-components">移动端组件</TabsTrigger>
        </TabsList>

        {/* 瓷砖特色组件 */}
        <TabsContent value="tile-components" className="space-y-6">
          {/* 色号显示器 */}
          <Card>
            <CardHeader>
              <CardTitle>色号显示器</CardTitle>
              <CardDescription>
                展示瓷砖色号，支持颜色可视化和交互选择
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="mb-2 font-medium">基础展示</h4>
                  <div className="flex flex-wrap gap-2">
                    <ColorCodeDisplay colorCode="W001" />
                    <ColorCodeDisplay colorCode="G003" />
                    <ColorCodeDisplay colorCode="BR002" />
                    <ColorCodeDisplay colorCode="BL004" />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 font-medium">色号选择器</h4>
                  <div className="max-w-xs">
                    <ColorCodeSelector
                      value={selectedColorCode}
                      onValueChange={setSelectedColorCode}
                    />
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">
                    当前选中: {selectedColorCode}
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 font-medium">色号网格</h4>
                  <ColorCodeGrid
                    colorCodes={[
                      'W001',
                      'W002',
                      'G001',
                      'G002',
                      'BR001',
                      'BR002',
                      'BL001',
                      'BL002',
                    ]}
                    selectedColorCode={selectedColorCode}
                    onColorCodeSelect={setSelectedColorCode}
                    columns={4}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 规格展示器 */}
          <Card>
            <CardHeader>
              <CardTitle>规格展示器</CardTitle>
              <CardDescription>
                展示瓷砖的详细规格信息，包括尺寸、厚度、表面处理等
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-medium">详细规格</h4>
                  <SpecificationDisplay
                    specification={sampleSpecification}
                    showAll
                  />
                </div>
                <div>
                  <h4 className="mb-2 font-medium">紧凑模式</h4>
                  <SpecificationDisplay
                    specification={sampleSpecification}
                    compact
                  />
                </div>
              </div>
            </CardContent>
          </Card>



          {/* 库存状态指示器 */}
          <Card>
            <CardHeader>
              <CardTitle>库存状态指示器</CardTitle>
              <CardDescription>
                显示库存状态、预警级别和库存健康度
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div>
                  <h4 className="mb-2 font-medium">状态指示器</h4>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    <InventoryStatusIndicator
                      status="in_stock"
                      currentStock={150}
                      safetyStock={100}
                      showQuantity
                    />
                    <InventoryStatusIndicator
                      status="low_stock"
                      currentStock={50}
                      safetyStock={100}
                      showQuantity
                    />
                    <InventoryStatusIndicator
                      status="out_of_stock"
                      currentStock={0}
                      safetyStock={100}
                      showQuantity
                    />
                    <InventoryStatusIndicator
                      status="overstock"
                      currentStock={500}
                      safetyStock={100}
                      showQuantity
                    />
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 font-medium">快速状态切换</h4>
                  <QuickStatusToggle
                    currentStatus={inventoryStatus}
                    onStatusChange={setInventoryStatus}
                  />
                  <p className="mt-2 text-sm text-muted-foreground">
                    当前状态: {inventoryStatus}
                  </p>
                </div>

                <Separator />

                <div>
                  <h4 className="mb-2 font-medium">库存健康度</h4>
                  <InventoryHealth
                    items={sampleProducts.map(p => ({
                      id: p.id,
                      name: p.name,
                      currentStock: p.stock,
                      safetyStock: p.safetyStock,
                      status: p.status,
                    }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 移动端组件 */}
        <TabsContent value="mobile-components" className="space-y-6">
          {/* 移动端搜索栏 */}
          <Card>
            <CardHeader>
              <CardTitle>移动端搜索栏</CardTitle>
              <CardDescription>
                移动端优化的搜索和筛选组件，支持多种筛选类型
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MobileSearchBar
                value={searchState}
                onChange={setSearchState}
                placeholder="搜索产品..."
                filterOptions={filterOptions}
                sortOptions={sortOptions}
                onSearch={state => console.log('搜索:', state)}
              />
            </CardContent>
          </Card>

          {/* 移动端数据表格 */}
          <Card>
            <CardHeader>
              <CardTitle>移动端数据表格</CardTitle>
              <CardDescription>
                响应式数据表格，桌面端显示表格，移动端显示卡片
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MobileDataTable
                data={sampleProducts}
                columns={columns}
                onRowClick={record => console.log('点击行:', record)}
                actions={[
                  {
                    key: 'edit',
                    label: '编辑',
                    onClick: record => console.log('编辑:', record),
                    variant: 'outline',
                  },
                  {
                    key: 'delete',
                    label: '删除',
                    onClick: record => console.log('删除:', record),
                    variant: 'destructive',
                  },
                ]}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
            <div>
              <h4 className="mb-2 font-medium">技术特性</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 基于 shadcn/ui 构建</li>
                <li>• 完整的 TypeScript 类型支持</li>
                <li>• 移动端响应式设计</li>
                <li>• Tailwind CSS 样式系统</li>
                <li>• 无障碍访问支持</li>
              </ul>
            </div>
            <div>
              <h4 className="mb-2 font-medium">瓷砖行业特色</h4>
              <ul className="space-y-1 text-muted-foreground">
                <li>• 色号可视化展示</li>
                <li>• 完整的规格信息管理</li>
                <li>• 生产批次追踪</li>
                <li>• 库存状态智能提醒</li>
                <li>• 行业标准数据结构</li>
              </ul>
            </div>
          </div>

          <Separator />

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              更多使用方法请参考
              <Button variant="link" className="h-auto p-0 text-sm">
                UI组件库使用指南
              </Button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
