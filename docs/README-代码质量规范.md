# 代码质量规范

## 📋 总则

### 核心原则
- **唯一真理源原则**: 每个概念、配置或数据在系统中只有一个明确的、权威的来源
- **约定优于配置**: 严格遵循各工具官方推荐的默认方式和项目结构
- **类型即文档原则**: TypeScript 类型和 Zod Schema 是主要的、活的文档
- **自动化第一**: 所有能自动化的流程都必须通过工具固化

## 🏗️ 项目结构规范

### 目录命名约定
```
app/                    # Next.js App Router 主目录
├── (dashboard)/        # 仪表板路由组
├── api/               # API 路由
└── auth/              # 认证相关页面

components/            # 所有组件
├── ui/               # shadcn/ui 组件（不得擅自修改）
└── common/           # 项目通用业务组件

lib/                  # 工具函数和配置
├── api/              # API 客户端函数
├── validations/      # Zod 验证规则
└── utils.ts          # 通用工具函数

types/                # 全局类型定义
public/               # 静态资源
scripts/              # 开发和测试脚本
docs/                 # 项目文档
```

### 文件命名规范
- **文件与目录**: 使用 `kebab-case`（短横线连接）
- **组件文件**: 使用 `PascalCase`（大驼峰）
- **类型定义**: 使用 `PascalCase`
- **环境变量**: 使用 `UPPER_SNAKE_CASE`

## 🔤 字段命名约定

### 数据库层 (MySQL/Prisma)
```sql
-- 使用 snake_case
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  user_name VARCHAR(50),
  email_address VARCHAR(100),
  is_active BOOLEAN,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### API 响应层
```typescript
// 使用 camelCase
interface UserResponse {
  id: string;
  userName: string;
  emailAddress: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 前端层
```typescript
// 使用 camelCase，与 API 响应保持一致
const [userData, setUserData] = useState({
  userName: '',
  emailAddress: '',
  isActive: true
});
```

## 📝 代码编写规范

### TypeScript 规范
```typescript
// ✅ 正确：明确的类型定义
interface ProductCreateInput {
  name: string;
  categoryId: string;
  price: number;
  thickness?: number;
}

// ❌ 错误：使用 any 类型
function processData(data: any) { }

// ✅ 正确：使用泛型
function processData<T>(data: T): T { }
```

### React 组件规范
```typescript
// ✅ 正确：使用 forwardRef 和明确的 props 类型
interface ButtonProps {
  variant?: 'default' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  children: React.ReactNode;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'default', size = 'md', children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(buttonVariants({ variant, size }))}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
```

### API 路由规范
```typescript
// ✅ 正确：完整的 API 路由结构
export async function POST(request: NextRequest) {
  try {
    // 1. 身份验证
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: '未授权访问' }, { status: 401 });
    }

    // 2. 输入验证
    const body = await request.json();
    const validationResult = createProductSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json({ error: '输入数据无效' }, { status: 400 });
    }

    // 3. 业务逻辑
    const product = await prisma.product.create({
      data: validationResult.data
    });

    // 4. 统一响应格式
    return NextResponse.json({
      success: true,
      data: product
    });
  } catch (error) {
    console.error('创建产品失败:', error);
    return NextResponse.json(
      { error: '服务器内部错误' },
      { status: 500 }
    );
  }
}
```

## 🎨 UI 和样式规范

### 组件使用规范
```typescript
// ✅ 正确：使用 shadcn/ui 组件
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

// ❌ 错误：直接使用原生 HTML 元素
<button className="...">点击</button>
<input className="..." />

// ✅ 正确：使用组件库
<Button variant="default">点击</Button>
<Input placeholder="请输入..." />
```

### 样式编写规范
```typescript
// ✅ 正确：使用 Tailwind CSS 工具类
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-sm">
  <h2 className="text-lg font-semibold text-gray-900">标题</h2>
  <Button size="sm">操作</Button>
</div>

// ❌ 错误：使用内联样式
<div style={{ display: 'flex', padding: '16px' }}>
  内容
</div>

// ❌ 错误：创建自定义 CSS 文件
// custom.css
.my-custom-style { ... }
```

## 🔍 数据验证规范

### Zod Schema 定义
```typescript
// ✅ 正确：详细的验证规则
export const productValidations = {
  create: z.object({
    name: z.string()
      .min(1, '产品名称不能为空')
      .max(100, '产品名称最多100个字符'),
    categoryId: z.string()
      .min(1, '分类ID不能为空'),
    price: z.number()
      .min(0, '价格不能为负数')
      .max(999999.99, '价格不能超过999999.99'),
    thickness: z.number()
      .min(0.1, '厚度不能小于0.1mm')
      .max(100, '厚度不能超过100mm')
      .optional()
  })
};

// 导出类型
export type ProductCreateInput = z.infer<typeof productValidations.create>;
```

## 🔄 状态管理规范

### TanStack Query 使用
```typescript
// ✅ 正确：使用 TanStack Query 管理服务器状态
const { data: products, isLoading, error } = useQuery({
  queryKey: ['products', { page, limit, search }],
  queryFn: () => fetchProducts({ page, limit, search }),
  staleTime: 5 * 60 * 1000, // 5分钟
});

// 变更操作
const deleteMutation = useMutation({
  mutationFn: deleteProduct,
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['products'] });
    toast.success('删除成功');
  },
  onError: (error) => {
    toast.error(`删除失败: ${error.message}`);
  }
});
```

### 本地状态管理
```typescript
// ✅ 正确：简单状态使用 useState
const [selectedItems, setSelectedItems] = useState<string[]>([]);
const [isDialogOpen, setIsDialogOpen] = useState(false);

// ✅ 正确：复杂状态使用 useReducer
const [state, dispatch] = useReducer(formReducer, initialState);
```

## 🧪 测试规范

### 单元测试
```typescript
// ✅ 正确：API 路由测试
describe('POST /api/products', () => {
  it('应该成功创建产品', async () => {
    const productData = {
      name: '测试产品',
      categoryId: 'cat-1',
      price: 99.99
    };

    const response = await POST(
      new NextRequest('http://localhost:3000/api/products', {
        method: 'POST',
        body: JSON.stringify(productData)
      })
    );

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.name).toBe('测试产品');
  });
});
```

## 🚨 错误处理规范

### 统一错误处理
```typescript
// ✅ 正确：统一的错误响应格式
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: any;
}

// API 错误处理
try {
  // 业务逻辑
} catch (error) {
  console.error('操作失败:', error);
  
  if (error instanceof PrismaClientKnownRequestError) {
    return NextResponse.json(
      { success: false, error: '数据库操作失败' },
      { status: 400 }
    );
  }
  
  return NextResponse.json(
    { success: false, error: '服务器内部错误' },
    { status: 500 }
  );
}
```

## 📚 文档规范

### 代码注释
```typescript
/**
 * 批量删除产品
 * @param productIds 要删除的产品ID数组
 * @returns 删除结果，包含成功和失败的详细信息
 */
export async function batchDeleteProducts(
  productIds: string[]
): Promise<BatchDeleteResult> {
  // 实现逻辑...
}
```

### README 文档
- 每个主要功能模块都应有对应的文档
- 文档应包含使用示例和注意事项
- 保持文档与代码同步更新

## ✅ 代码质量检查

### 提交前检查清单
- [ ] ESLint 检查通过
- [ ] Prettier 格式化完成
- [ ] TypeScript 类型检查通过
- [ ] 单元测试通过
- [ ] 功能测试验证
- [ ] 文档更新完成

### 自动化工具
- **ESLint**: 代码质量检查
- **Prettier**: 代码格式化
- **Husky**: Git hooks 管理
- **lint-staged**: 暂存文件检查
- **TypeScript**: 类型检查

遵循这些规范，确保代码质量和项目的长期可维护性！
