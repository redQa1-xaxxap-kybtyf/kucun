# 03 - 后端 API 与服务设计

> 本文档定义打印设计器的后端实现，包括数据库模型、API 接口和 PDF 生成服务。

---

## 1. 数据库模型 (Prisma)

### 1.1 完整 Schema
```prisma
// prisma/schema.prisma (新增部分)

model PrintTemplate {
  id          String   @id @default(uuid()) @db.Char(36)
  name        String   @db.VarChar(100)
  description String?  @db.VarChar(500)
  
  /// 模板类型
  type        String   @map("template_type") @db.VarChar(50)
  
  /// 是否为该类型的默认模板
  isDefault   Boolean  @default(false) @map("is_default")
  
  /// 模板配置 JSON (Zod Schema 验证)
  content     Json     @map("content")
  
  /// 缩略图 (可选, base64 或 URL)
  thumbnail   String?  @db.Text
  
  /// 状态
  status      String   @default("active") @db.VarChar(20)
  
  /// 是否为系统内置模板 (不可删除)
  isSystem    Boolean  @default(false) @map("is_system")
  
  /// 审计
  createdBy   String   @map("created_by") @db.Char(36)
  updatedBy   String   @map("updated_by") @db.Char(36)
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  creator     User     @relation("TemplateCreator", fields: [createdBy], references: [id])
  updater     User     @relation("TemplateUpdater", fields: [updatedBy], references: [id])

  @@index([type, status], map: "idx_template_type_status")
  @@index([isDefault], map: "idx_template_default")
  @@index([createdBy], map: "idx_template_creator")
  @@map("print_templates")
}
```

### 1.2 User 模型扩展
```prisma
model User {
  // ... 现有字段
  
  createdTemplates PrintTemplate[] @relation("TemplateCreator")
  updatedTemplates PrintTemplate[] @relation("TemplateUpdater")
}
```

---

## 2. Server Actions

### 2.1 模板 CRUD
```typescript
// actions/print-template.ts
'use server';

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { PrintTemplateSchema } from '@/lib/print-designer/schemas';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

const InputSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  type: z.string(),
  content: z.any(), // 在内部用 PrintTemplateSchema 严格校验
});

/**
 * 保存模板 (创建或更新)
 */
export async function saveTemplate(input: z.infer<typeof InputSchema>) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Unauthorized');

  // 校验 content 结构
  const validatedContent = PrintTemplateSchema.parse(input.content);

  const data = {
    name: input.name,
    description: input.description,
    type: input.type,
    content: validatedContent,
    updatedBy: session.user.id,
  };

  if (input.id) {
    // 更新
    await prisma.printTemplate.update({
      where: { id: input.id },
      data,
    });
  } else {
    // 创建
    await prisma.printTemplate.create({
      data: {
        ...data,
        createdBy: session.user.id,
      },
    });
  }

  revalidatePath('/settings/print-templates');
  return { success: true };
}

/**
 * 获取模板列表
 */
export async function getTemplates(type?: string) {
  return prisma.printTemplate.findMany({
    where: {
      status: 'active',
      ...(type && { type }),
    },
    select: {
      id: true,
      name: true,
      type: true,
      isDefault: true,
      thumbnail: true,
      updatedAt: true,
    },
    orderBy: [
      { isDefault: 'desc' },
      { updatedAt: 'desc' },
    ],
  });
}

/**
 * 获取单个模板详情
 */
export async function getTemplate(id: string) {
  const template = await prisma.printTemplate.findUnique({
    where: { id },
  });
  if (!template) throw new Error('Template not found');
  return template;
}

/**
 * 设置默认模板
 */
export async function setDefaultTemplate(id: string, type: string) {
  await prisma.$transaction([
    // 取消同类型其他默认
    prisma.printTemplate.updateMany({
      where: { type, isDefault: true },
      data: { isDefault: false },
    }),
    // 设置新默认
    prisma.printTemplate.update({
      where: { id },
      data: { isDefault: true },
    }),
  ]);
  
  revalidatePath('/settings/print-templates');
}

/**
 * 删除模板
 */
export async function deleteTemplate(id: string) {
  const template = await prisma.printTemplate.findUnique({ where: { id } });
  if (template?.isSystem) throw new Error('Cannot delete system template');
  
  await prisma.printTemplate.update({
    where: { id },
    data: { status: 'deleted' },
  });
  
  revalidatePath('/settings/print-templates');
}
```

---

## 3. PDF 生成服务

### 3.1 架构选择
| 方案 | 适用场景 | 优缺点 |
|---|---|---|
| `window.print()` | 用户主动打印 | ✅ 简单 ❌ 无法自动化 |
| `jsPDF` | 简单文档 | ✅ 前端运行 ❌ 中文支持差、排版弱 |
| `Puppeteer` | 复杂报表 | ✅ 像素级还原 ❌ 需后端资源 |

**推荐**: 用户手动打印用 `window.print()`，自动化场景（邮件发送）用 Puppeteer。

### 3.2 Puppeteer 服务实现
```typescript
// lib/services/pdf-generator.ts
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

interface PdfOptions {
  template: any;
  data: any;
  format?: 'A4' | 'A5';
}

export async function generatePdf(options: PdfOptions): Promise<Buffer> {
  const browser = await puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath(),
    headless: chromium.headless,
  });

  try {
    const page = await browser.newPage();
    
    // 构建 HTML
    const html = buildPrintHtml(options.template, options.data);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // 生成 PDF
    const pdf = await page.pdf({
      format: options.format || 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });

    return Buffer.from(pdf);
  } finally {
    await browser.close();
  }
}

function buildPrintHtml(template: any, data: any): string {
  // 将模板 JSON + 数据渲染为纯净 HTML
  // 复用前端的 PrintCanvas 渲染逻辑 (SSR)
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <style>${getPrintStyles()}</style>
      </head>
      <body>
        ${renderTemplate(template, data)}
      </body>
    </html>
  `;
}
```

### 3.3 API Route 封装
```typescript
// app/api/print/generate-pdf/route.ts
import { generatePdf } from '@/lib/services/pdf-generator';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const { templateId, data } = await request.json();
    
    // 获取模板
    const template = await prisma.printTemplate.findUnique({
      where: { id: templateId },
    });
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    // 生成 PDF
    const pdfBuffer = await generatePdf({
      template: template.content,
      data,
    });

    return new NextResponse(pdfBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="print-${Date.now()}.pdf"`,
      },
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    return NextResponse.json({ error: 'PDF generation failed' }, { status: 500 });
  }
}
```

---

## 4. 缓存策略

### 4.1 默认模板缓存
```typescript
// lib/cache/template-cache.ts
import { unstable_cache } from 'next/cache';

export const getDefaultTemplate = unstable_cache(
  async (type: string) => {
    return prisma.printTemplate.findFirst({
      where: { type, isDefault: true, status: 'active' },
    });
  },
  ['default-template'],
  { revalidate: 3600, tags: ['print-templates'] }
);
```

### 4.2 缓存失效
```typescript
// 在 saveTemplate / setDefaultTemplate 后
import { revalidateTag } from 'next/cache';
revalidateTag('print-templates');
```

---

## 5. 权限控制

| 角色 | 查看模板 | 编辑模板 | 删除模板 | 设置默认 |
|---|---|---|---|---|
| 普通员工 | ✅ | ❌ | ❌ | ❌ |
| 运营 | ✅ | ✅ | ❌ | ❌ |
| 管理员 | ✅ | ✅ | ✅ | ✅ |

```typescript
// lib/auth/permissions.ts
export const templatePermissions = {
  view: ['sales', 'operator', 'admin'],
  edit: ['operator', 'admin'],
  delete: ['admin'],
  setDefault: ['admin'],
};
```
