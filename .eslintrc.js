/**
 * ESLint配置文件
 * 严格遵循全栈项目统一约定规范
 *
 * 配置说明：
 * - 基于Next.js官方推荐配置
 * - 集成TypeScript严格检查
 * - 包含React和React Hooks规则
 * - 自定义项目特定规则
 */

module.exports = {
  root: true,
  env: {
    browser: true,
    es2022: true,
    node: true,
  },
  extends: [
    'next/core-web-vitals',
    'prettier', // 必须放在最后，禁用与Prettier冲突的规则
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ['@typescript-eslint', 'react', 'react-hooks'],
  rules: {
    // TypeScript规则
    '@typescript-eslint/no-unused-vars': [
      'error',
      {
        argsIgnorePattern: '^_',
        varsIgnorePattern: '^_',
        caughtErrorsIgnorePattern: '^_',
      },
    ],
    '@typescript-eslint/no-explicit-any': 'warn',

    '@typescript-eslint/no-non-null-assertion': 'warn',
    '@typescript-eslint/consistent-type-imports': [
      'error',
      {
        prefer: 'type-imports',
        disallowTypeAnnotations: false,
      },
    ],

    // React规则
    'react/jsx-uses-react': 'off', // Next.js 13+ 不需要导入React
    'react/react-in-jsx-scope': 'off', // Next.js 13+ 不需要导入React
    'react/prop-types': 'off', // 使用TypeScript进行类型检查
    'react/display-name': 'warn',
    'react-hooks/rules-of-hooks': 'error',
    'react-hooks/exhaustive-deps': 'warn',

    // 通用规则
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-alert': 'warn',
    'prefer-const': 'error',
    'no-var': 'error',
    'object-shorthand': 'error',
    'prefer-template': 'error',
    'template-curly-spacing': ['error', 'never'],
    'no-multiple-empty-lines': [
      'error',
      {
        max: 2,
        maxEOF: 1,
        maxBOF: 0,
      },
    ],

    // 导入规则
    'import/order': [
      'error',
      {
        groups: [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index',
        ],
        'newlines-between': 'always',
        alphabetize: {
          order: 'asc',
          caseInsensitive: true,
        },
      },
    ],
    'import/no-duplicates': 'error',
    'import/no-unresolved': 'off', // TypeScript处理模块解析

    // Next.js特定规则
    '@next/next/no-img-element': 'error',
    '@next/next/no-html-link-for-pages': 'error',

    // 项目特定规则
    'prefer-arrow-callback': 'error',
    'arrow-body-style': ['error', 'as-needed'],
    'no-duplicate-imports': 'error',
    'no-useless-rename': 'error',
    'object-curly-spacing': ['error', 'always'],
    'array-bracket-spacing': ['error', 'never'],
    'computed-property-spacing': ['error', 'never'],
    'func-call-spacing': ['error', 'never'],
    'key-spacing': [
      'error',
      {
        beforeColon: false,
        afterColon: true,
      },
    ],
    'comma-spacing': [
      'error',
      {
        before: false,
        after: true,
      },
    ],
    'semi-spacing': [
      'error',
      {
        before: false,
        after: true,
      },
    ],
  },
  overrides: [
    // API路由特殊规则
    {
      files: ['app/api/**/*.ts'],
      rules: {
        'no-console': 'off', // API路由允许console.log用于调试
      },
    },
    // 配置文件特殊规则
    {
      files: [
        '*.config.js',
        '*.config.ts',
        '.eslintrc.js',
        'tailwind.config.js',
        'next.config.js',
      ],
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
        'no-undef': 'off',
      },
    },
    // 测试文件特殊规则
    {
      files: ['**/__tests__/**/*', '**/*.test.*', '**/*.spec.*'],
      env: {
        jest: true,
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        'no-console': 'off',
      },
    },
  ],
  settings: {
    react: {
      version: 'detect',
    },
    'import/resolver': {
      typescript: {
        alwaysTryTypes: true,
        project: './tsconfig.json',
      },
    },
  },
  ignorePatterns: [
    'node_modules/',
    '.next/',
    'out/',
    'dist/',
    'build/',
    '*.min.js',
    'public/',
    '.env*',
    'coverage/',
    'prisma/migrations/',
  ],
};
