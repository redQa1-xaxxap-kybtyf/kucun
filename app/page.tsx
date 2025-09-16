import { Button } from '@/components/ui/button';

export default function HomePage() {
  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center">
        <h1 className="mb-4 text-4xl font-bold text-gray-900">库存管理工具</h1>
        <p className="mb-8 text-lg text-gray-600">
          专为瓷砖行业设计的库存管理工具
        </p>
        <div className="mb-6 rounded border border-green-400 bg-green-100 px-4 py-3 text-green-700">
          <p className="font-semibold">项目基础设施搭建完成！</p>
          <p className="mt-1 text-sm">
            Next.js 15.4 + TypeScript + Tailwind CSS + ESLint + Prettier + shadcn/ui
          </p>
        </div>
        <div className="space-x-4">
          <Button>默认按钮</Button>
          <Button variant="secondary">次要按钮</Button>
          <Button variant="outline">轮廓按钮</Button>
        </div>
      </div>
    </main>
  );
}
