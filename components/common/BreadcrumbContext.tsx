'use client';

import * as React from 'react';

/**
 * 面包屑动态标题上下文
 *
 * 允许页面组件设置动态的面包屑标题，替代默认的 "详情 #abc123" 显示
 *
 * 使用方式：
 * 1. 在页面组件中使用 useBreadcrumbTitle hook 设置标题
 *    useBreadcrumbTitle('2026年1月盘点 - A库区');
 *
 * 2. Breadcrumb 组件会自动读取并显示该标题
 */

interface BreadcrumbContextValue {
  /** 当前页面的动态标题 */
  dynamicTitle: string | null;
  /** 设置动态标题 */
  setDynamicTitle: (title: string | null) => void;
}

const BreadcrumbContext = React.createContext<BreadcrumbContextValue | null>(
  null
);

export function BreadcrumbProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [dynamicTitle, setDynamicTitle] = React.useState<string | null>(null);

  const value = React.useMemo(
    () => ({ dynamicTitle, setDynamicTitle }),
    [dynamicTitle]
  );

  return (
    <BreadcrumbContext.Provider value={value}>
      {children}
    </BreadcrumbContext.Provider>
  );
}

/**
 * 获取面包屑上下文
 */
export function useBreadcrumbContext() {
  const context = React.useContext(BreadcrumbContext);
  if (!context) {
    // 如果没有 Provider，返回一个无操作的默认值
    return { dynamicTitle: null, setDynamicTitle: () => {} };
  }
  return context;
}

/**
 * 设置页面的动态面包屑标题
 *
 * @param title 要显示的标题，传入 null 清除标题
 *
 * @example
 * // 在库存盘点详情页
 * useBreadcrumbTitle(`${countData.countName}`);
 *
 * // 在销售订单详情页
 * useBreadcrumbTitle(`订单 ${orderData.orderNumber}`);
 */
export function useBreadcrumbTitle(title: string | null) {
  const { setDynamicTitle } = useBreadcrumbContext();

  React.useEffect(() => {
    setDynamicTitle(title);

    // 组件卸载时清除标题
    return () => {
      setDynamicTitle(null);
    };
  }, [title, setDynamicTitle]);
}
