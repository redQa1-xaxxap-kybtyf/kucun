# 销售订单导出功能演示

## 功能概述

我们已经为销售订单详情页添加了完整的导出功能，包括：

1. **图片导出** - 将销售订单页面导出为PNG图片
2. **Excel导出** - 导出订单明细为Excel文件
3. **完整Excel导出** - 导出包含摘要和明细的完整Excel文件

## 功能特性

### 🖼️ 图片导出
- 高清图片输出（2倍缩放）
- 白色背景，适合打印和分享
- 自动生成文件名：`销售订单-{订单号}-{日期}.png`
- 动态加载html2canvas库，不影响首屏性能

### 📊 Excel导出
- 包含完整的订单明细信息
- 自动计算毛利率
- 中文字段标题
- 合适的列宽设置
- 自动生成文件名：`销售订单-{订单号}-{日期}.xlsx`

### 📋 完整Excel导出
- 包含订单摘要和明细两个工作表
- 订单摘要包含客户信息、金额汇总等
- 订单明细包含每个产品的详细信息
- 适合财务归档和分析

## 使用方法

### 在销售订单详情页

1. 进入任意销售订单详情页面
2. 点击右上角的"更多"按钮（三个点图标）
3. 选择导出选项：
   - **导出为图片** - 生成当前页面的截图
   - **导出Excel** - 生成订单明细Excel
   - **导出完整Excel** - 生成包含摘要的完整Excel

### 支持的订单状态
所有状态的订单都可以导出，包括：
- 草稿
- 已确认
- 已发货
- 已完成
- 已取消

## 技术实现

### 核心组件

1. **ExportService** (`lib/services/export-service.ts`)
   - 通用导出服务类
   - 支持图片和Excel导出
   - 可复用于其他模块

2. **SalesOrderExportService** (`lib/services/sales-order-export-service.ts`)
   - 专门处理销售订单导出
   - 格式化订单数据
   - 生成合适的文件名

3. **useSalesOrderExport** (`hooks/use-sales-order-export.ts`)
   - React Hook
   - 提供导出功能和状态管理
   - 错误处理和Toast提示

4. **ExportButtons** (`components/common/export-buttons.tsx`)
   - 可复用的导出按钮组件
   - 支持加载状态显示
   - 下拉菜单选择导出方式

### 技术栈

- **html2canvas** - 将DOM元素转换为图片
- **xlsx** - Excel文件生成库
- **file-saver** - 文件下载功能
- **React Hook** - 状态管理和副作用处理

### 性能优化

- html2canvas动态加载，不影响首屏性能
- 使用CDN加载html2canvas，减少bundle大小
- 错误边界处理，确保导出失败不影响主功能
- 内存管理，导出完成后清理缓存

## 文件结构

```
├── lib/services/
│   ├── export-service.ts              # 通用导出服务
│   └── sales-order-export-service.ts  # 销售订单导出服务
├── hooks/
│   └── use-sales-order-export.ts      # 导出Hook
├── components/
│   ├── common/
│   │   └── export-buttons.tsx         # 导出按钮组件
│   └── ui/
│       └── spinner.tsx                # 加载动画组件
└── app/(dashboard)/sales-orders/[id]/
    ├── page.tsx                       # 订单详情页
    └── components/
        └── HeaderCard.tsx             # 头部卡片组件（包含导出按钮）
```

## 代码示例

### 在其他组件中使用导出功能

```tsx
import { useSalesOrderExport } from '@/hooks/use-sales-order-export';

function MyComponent() {
  const {
    exportToImage,
    exportToExcel,
    isExportingImage,
    isExportingExcel
  } = useSalesOrderExport();

  const handleExport = async () => {
    const element = document.getElementById('export-content');
    if (element) {
      await exportToImage(element, {
        orderId: '123',
        orderNumber: 'SO202501001'
      });
    }
  };

  return (
    <button onClick={handleExport} disabled={isExportingImage}>
      {isExportingImage ? '导出中...' : '导出图片'}
    </button>
  );
}
```

### 使用通用导出服务

```typescript
import { ExportService } from '@/lib/services/export-service';

// 导出图片
await ExportService.exportToImage(element, {
  filename: 'custom-name',
  scale: 2,
  backgroundColor: '#ffffff'
});

// 导出Excel
ExportService.exportToExcel(data, {
  filename: 'custom-data',
  sheetName: '数据表',
  includeHeaders: true
});
```

## 扩展建议

1. **添加更多导出格式** - 如PDF、CSV等
2. **自定义导出模板** - 允许用户选择导出的字段和格式
3. **批量导出** - 支持批量导出多个订单
4. **导出历史记录** - 记录导出历史，方便重新下载
5. **邮件发送** - 导出后直接发送到客户邮箱

## 注意事项

1. 图片导出需要浏览器支持html2canvas
2. Excel导出需要现代浏览器支持
3. 导出大量数据时可能需要较长时间
4. 建议在导出时显示加载状态，提升用户体验
5. 确保导出的数据不包含敏感信息

## 故障排除

### 常见问题

1. **图片导出失败**
   - 检查是否有跨域图片
   - 确保html2canvas正确加载
   - 检查浏览器是否支持相关API

2. **Excel导出失败**
   - 检查数据格式是否正确
   - 确保有足够的数据权限
   - 检查文件名是否包含非法字符

3. **文件下载失败**
   - 检查浏览器下载设置
   - 确保下载权限正常
   - 尝试不同的文件名

如需更多帮助，请查看相关代码注释或联系开发团队。