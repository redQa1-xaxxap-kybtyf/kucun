import { redirect } from 'next/navigation';

/**
 * 根页面组件
 * 重定向逻辑已移至中间件处理，避免多次 session 查询
 * 这里仅作为备用重定向（通常不会执行到，因为中间件会先处理）
 */
export default function HomePage() {
  // 备用重定向到仪表盘（中间件已处理，这里通常不会执行）
  redirect('/dashboard');
}
