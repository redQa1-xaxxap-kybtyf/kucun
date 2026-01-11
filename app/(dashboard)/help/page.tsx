/**
 * 帮助中心页面
 * 提供系统使用指南、常见问题解答和联系支持等功能
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import {
    BookOpen,
    Download,
    ExternalLink,
    FileText,
    HelpCircle,
    Mail,
    MessageCircle,
    Phone,
    Video,
} from 'lucide-react';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';

export const metadata: Metadata = {
  title: '帮助中心 - 库存管理工具',
  description: '系统使用指南、常见问题解答和技术支持',
};

/**
 * 帮助分类配置
 */
const helpCategories = [
  {
    id: 'getting-started',
    title: '快速入门',
    description: '了解系统基本功能和操作流程',
    icon: BookOpen,
    items: [
      { title: '系统概览', description: '了解库存管理工具的核心功能' },
      { title: '用户登录', description: '如何登录系统' },
      { title: '界面导航', description: '熟悉系统界面和导航结构' },
      { title: '基本设置', description: '配置个人资料和系统偏好' },
    ],
  },
  {
    id: 'inventory-management',
    title: '库存管理',
    description: '产品入库、出库和库存调整操作指南',
    icon: FileText,
    items: [
      { title: '产品入库', description: '如何添加新产品到库存系统' },
      { title: '库存查询', description: '查看和搜索库存信息' },
      { title: '库存调整', description: '手动调整库存数量和状态' },
      { title: '出库操作', description: '处理产品出库和库存扣减' },
    ],
  },
  {
    id: 'sales-orders',
    title: '销售订单',
    description: '订单创建、管理和处理流程',
    icon: MessageCircle,
    items: [
      { title: '创建销售订单', description: '如何新建和配置销售订单' },
      { title: '订单状态管理', description: '跟踪和更新订单状态' },
      { title: '订单号生成', description: '理解订单编号规则' },
      { title: '成本计算', description: '订单成本和利润计算方式' },
    ],
  },
  {
    id: 'customer-management',
    title: '客户管理',
    description: '客户信息维护和关系管理',
    icon: Phone,
    items: [
      { title: '客户档案', description: '创建和维护客户基本信息' },
      { title: '客户分类', description: '客户分组和标签管理' },
      { title: '交易记录', description: '查看客户历史交易记录' },
      { title: '信用管理', description: '客户信用额度和风险控制' },
    ],
  },
];

/**
 * 常见问题配置
 */
const faqItems = [
  {
    question: '如何重置密码？',
    answer:
      '在登录页面点击"忘记密码"，输入注册邮箱，系统会发送重置链接到您的邮箱。',
  },
  {
    question: '库存数据不准确怎么办？',
    answer:
      '可以使用库存调整功能手动修正数据，或联系管理员进行数据核查和修复。',
  },
  {
    question: '如何导出数据？',
    answer:
      '在各个列表页面点击导出按钮，选择需要的数据格式（Excel、CSV等）进行下载。',
  },
  {
    question: '系统支持哪些浏览器？',
    answer:
      '推荐使用Chrome、Firefox、Safari或Edge的最新版本，确保最佳使用体验。',
  },
  {
    question: '如何联系技术支持？',
    answer:
      '可以通过页面底部的联系方式，或在系统内提交反馈表单联系我们的技术支持团队。',
  },
];

/**
 * 联系方式配置
 */
const contactMethods = [
  {
    type: '在线客服',
    description: '工作日 9:00-18:00',
    icon: MessageCircle,
    action: '开始对话',
    href: '#',
  },
  {
    type: '技术支持热线',
    description: '400-123-4567',
    icon: Phone,
    action: '拨打电话',
    href: 'tel:400-123-4567',
  },
  {
    type: '邮件支持',
    description: 'support@example.com',
    icon: Mail,
    action: '发送邮件',
    href: 'mailto:support@example.com',
  },
];

/**
 * 帮助中心主页面组件
 */
export default function HelpPage() {
  return (
    <div className="flex h-full flex-col overflow-y-auto bg-slate-50/50 p-4 lg:p-10 xl:p-14">
      <div className="mx-auto w-full max-w-[1680px] space-y-12">
        {/* 1. Identity Header: 帮助门户标头 */}
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between px-2">
          <div className="flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-900 shadow-xl shadow-slate-900/10 ring-4 ring-white">
              <HelpCircle className="h-8 w-8 text-white" />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tighter text-slate-900">
                  帮助与服务中心
                </h1>
                <Badge className="bg-slate-900 text-white hover:bg-slate-800 text-[10px] font-black uppercase tracking-widest px-2.5 py-1">
                  Support Hub
                </Badge>
              </div>
              <p className="text-sm font-bold text-slate-400">
                为您提供系统操作指南、常见问题解答及全方位的技术支持服务
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              className="h-11 rounded-xl border-slate-200 bg-white px-6 text-xs font-black text-slate-900 shadow-sm hover:bg-slate-50 transition-all active:scale-95"
            >
              <Mail className="mr-2 h-4 w-4 text-slate-400" />
              提交问题反馈
            </Button>
          </div>
        </div>

        {/* 2. Service Matrix: 快速响应矩阵 */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {[
            { title: '操作教学视频', desc: '手把手带您熟悉核心业务流程', icon: Video, color: 'text-blue-500', bg: 'bg-blue-50/50', action: '立即观看' },
            { title: '用户使用手册', desc: '完整的系统功能字典与操作规范', icon: Download, color: 'text-emerald-500', bg: 'bg-emerald-50/50', action: '下载 PDF' },
            { title: '专家在线诊断', desc: '针对复杂业务场景提供即时支持', icon: MessageCircle, color: 'text-purple-500', bg: 'bg-purple-50/50', action: '发起咨询' }
          ].map((service, i) => (
            <div key={i} className="group relative overflow-hidden rounded-3xl border border-slate-100 bg-white p-8 shadow-sm transition-all hover:border-blue-100 hover:shadow-lg">
              <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-50 transition-transform group-hover:scale-110">
                <service.icon className={cn("h-6 w-6", service.color)} />
              </div>
              <h3 className="mb-2 text-lg font-black text-slate-900">{service.title}</h3>
              <p className="mb-6 text-sm font-medium text-slate-400 leading-relaxed">{service.desc}</p>
              <Button 
                variant="ghost" 
                className={cn("h-9 rounded-xl p-0 text-xs font-black transition-all hover:bg-transparent", service.color)}
              >
                {service.action} <ExternalLink className="ml-2 h-3.3" />
              </Button>
              <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-0 transition-opacity group-hover:opacity-10", service.bg)} />
            </div>
          ))}
        </div>

        <div className="grid gap-12 lg:grid-cols-[2.5fr_1fr]">
          {/* 3. Main Guide Area: 结构化指南聚合 */}
          <div className="space-y-10">
            <section className="space-y-6">
              <div className="flex flex-col gap-1 px-1">
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">系统操作指南目录</h3>
                <p className="text-[11px] font-medium text-slate-400">按照业务模块分类的详细操作说明</p>
              </div>

              <div className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm shadow-slate-200/50 transition-all hover:shadow-md">
                <div className="divide-y divide-slate-50">
                  {helpCategories.map((category) => {
                    const IconComponent = category.icon;
                    return (
                      <div key={category.id} className="p-8 transition-colors hover:bg-slate-50/30">
                        <div className="mb-8 flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                            <IconComponent className="h-5 w-5 text-slate-600" />
                          </div>
                          <div>
                            <h4 className="text-base font-black text-slate-900">{category.title}</h4>
                            <p className="text-[11px] font-medium text-slate-400">{category.description}</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                          {category.items.map((item, index) => (
                            <button
                              key={index}
                              className="flex flex-col items-start rounded-2xl border border-slate-50 bg-white p-5 text-left transition-all hover:border-blue-100 hover:shadow-sm group"
                            >
                              <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">
                                {item.title}
                              </span>
                              <span className="mt-1 text-[11px] font-medium text-slate-400 leading-relaxed">
                                {item.description}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>

          {/* 4. Support Sidebar: 精捷支持模块 */}
          <div className="space-y-10">
            {/* 常见问题模块 */}
            <section className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">智库 FAQ</h3>
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="space-y-6">
                  {faqItems.map((faq, index) => (
                    <div key={index} className="space-y-2 group">
                      <h4 className="flex items-center gap-2 text-sm font-black text-slate-800 transition-colors group-hover:text-blue-600">
                        <div className="h-1.5 w-1.5 rounded-full bg-slate-200 group-hover:bg-blue-400" />
                        {faq.question}
                      </h4>
                      <p className="pl-3.5 text-[11px] font-medium text-slate-400 leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            {/* 专业支持渠道 */}
            <section className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">专业支持反馈</h3>
              <div className="rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden">
                <div className="divide-y divide-slate-50">
                  {contactMethods.map((method, index) => {
                    const IconComponent = method.icon;
                    return (
                      <a 
                        key={index} 
                        href={method.href}
                        className="flex items-center justify-between p-5 transition-all hover:bg-slate-50 group"
                      >
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 group-hover:bg-white transition-colors">
                            <IconComponent className="h-5 w-5 text-slate-400 group-hover:text-slate-900" />
                          </div>
                          <div className="space-y-0.5">
                            <span className="text-sm font-black text-slate-900">{method.type}</span>
                            <p className="text-[10px] font-medium text-slate-400">{method.description}</p>
                          </div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-200 group-hover:text-slate-400" />
                      </a>
                    );
                  })}
                </div>
              </div>
            </section>

            {/* 系统服务健康度 */}
            <section className="space-y-6">
              <h3 className="text-[11px] font-black uppercase tracking-widest text-slate-400 px-1">系统服务状态</h3>
              <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-black text-slate-900">核心引擎状态</span>
                    <p className="text-[10px] font-medium text-slate-400">所有数据中心均处于最优负载</p>
                  </div>
                  <Badge className="bg-emerald-50 text-emerald-600 border-none px-3 py-1 font-black flex items-center gap-2">
                    <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    正常运行
                  </Badge>
                </div>
                <Separator className="my-5 bg-slate-50" />
                <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest text-right">
                  Last Updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
