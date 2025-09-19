/**
 * 404 页面 - 页面未找到
 * 遵循 Next.js 15.4 App Router 规范
 */

import Link from 'next/link';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="mb-4 text-6xl font-bold text-gray-400">
            404
          </CardTitle>
          <h1 className="text-2xl font-semibold text-gray-900">页面未找到</h1>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-gray-600">抱歉，您访问的页面不存在或已被移动。</p>
          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild>
              <Link href="/">返回首页</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/dashboard">前往控制台</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
