# 代码风格和约定

## 命名规范

- **数据库字段**: snake_case (Prisma schema)
- **API响应**: camelCase
- **前端变量/函数**: camelCase
- **React组件**: PascalCase
- **环境变量**: UPPER_SNAKE_CASE
- **类型/接口**: PascalCase

## TypeScript配置

- **严格模式**: 启用 (`strict: true`)
- **noImplicitReturns**: true
- **noFallthroughCasesInSwitch**: true
- **noImplicitOverride**: true
- **noUnusedLocals/Parameters**: 由ESLint处理
- **目标**: ES2022
- **模块**: ESNext with bundler resolution

## ESLint规则

- `prefer-const`: error
- `no-var`: error
- `no-console`: warn (允许warn和error)
- `eqeqeq`: always
- `curly`: all

## Prettier配置

- Semi: true
- Single quotes: true
- Print width: 80
- Tab width: 2
- Trailing comma: es5
- Arrow parens: avoid
- End of line: lf

## 代码组织原则

1. **全栈类型安全**: TypeScript + Prisma + Zod端到端类型安全
2. **组件复用**: 严格使用shadcn/ui，禁止重复开发
3. **关注点分离**: API handlers、业务逻辑、UI组件分离
4. **SOLID原则**: 单一职责、依赖注入、接口隔离
5. **DRY原则**: 避免代码重复

## 性能意识

- 算法复杂度优化
- 内存使用控制
- IO操作优化
- 使用React Query缓存
- 使用Redis缓存API响应

## 测试思维

- 可测试设计
- 边界条件处理
- 错误处理完整性
