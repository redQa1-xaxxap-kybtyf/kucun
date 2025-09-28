/**
 * 帮助中心页面
 * 提供系统使用指南、常见问题解答和联系支持等功能
 * 严格遵循全局约定规范和ESLint规范遵循指南
 */

import {
  BookOpen,
  HelpCircle,
  MessageCircle,
  Phone,
  Mail,
  FileText,
  Video,
  Download,
  ExternalLink,
} from 'lucide-react';
import type { Metadata } from 'next';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

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
      { title: '用户注册与登录', description: '如何创建账户并登录系统' },
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
    <div className="container mx-auto max-w-6xl px-4 py-8">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="mb-2 text-3xl font-bold text-gray-900">帮助中心</h1>
        <p className="text-gray-600">
          欢迎使用库存管理工具帮助中心，这里有您需要的所有使用指南和支持信息
        </p>
      </div>

      {/* 快速链接 */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6 text-center">
            <Video className="mx-auto mb-3 h-8 w-8 text-blue-600" />
            <h3 className="mb-2 font-semibold">视频教程</h3>
            <p className="mb-4 text-sm text-gray-600">观看操作演示视频</p>
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-2 h-4 w-4" />
              观看视频
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6 text-center">
            <Download className="mx-auto mb-3 h-8 w-8 text-green-600" />
            <h3 className="mb-2 font-semibold">用户手册</h3>
            <p className="mb-4 text-sm text-gray-600">下载完整操作手册</p>
            <Button variant="outline" size="sm">
              <Download className="mr-2 h-4 w-4" />
              下载PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="transition-shadow hover:shadow-md">
          <CardContent className="p-6 text-center">
            <MessageCircle className="mx-auto mb-3 h-8 w-8 text-purple-600" />
            <h3 className="mb-2 font-semibold">在线支持</h3>
            <p className="mb-4 text-sm text-gray-600">联系技术支持团队</p>
            <Button variant="outline" size="sm">
              <MessageCircle className="mr-2 h-4 w-4" />
              联系客服
            </Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* 帮助分类 */}
        <div className="lg:col-span-2">
          <h2 className="mb-6 text-2xl font-semibold">使用指南</h2>
          <div className="space-y-6">
            {helpCategories.map(category => {
              const IconComponent = category.icon;
              return (
                <Card
                  key={category.id}
                  className="transition-shadow hover:shadow-md"
                >
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-6 w-6 text-blue-600" />
                      <div>
                        <CardTitle className="text-lg">
                          {category.title}
                        </CardTitle>
                        <CardDescription>
                          {category.description}
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {category.items.map((item, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          className="h-auto justify-start p-3 text-left"
                        >
                          <div>
                            <div className="text-sm font-medium">
                              {item.title}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">
                              {item.description}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 侧边栏 */}
        <div className="space-y-6">
          {/* 常见问题 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="h-5 w-5" />
                常见问题
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {faqItems.map((faq, index) => (
                <div
                  key={index}
                  className="border-b border-gray-100 pb-3 last:border-0 last:pb-0"
                >
                  <h4 className="mb-2 text-sm font-medium">{faq.question}</h4>
                  <p className="text-xs text-gray-600">{faq.answer}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 联系支持 */}
          <Card>
            <CardHeader>
              <CardTitle>联系支持</CardTitle>
              <CardDescription>
                需要更多帮助？联系我们的支持团队
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {contactMethods.map((method, index) => {
                const IconComponent = method.icon;
                return (
                  <Button
                    key={index}
                    variant="outline"
                    className="h-auto w-full justify-start p-3"
                    asChild
                  >
                    <a href={method.href}>
                      <IconComponent className="mr-3 h-4 w-4" />
                      <div className="text-left">
                        <div className="text-sm font-medium">{method.type}</div>
                        <div className="text-xs text-gray-500">
                          {method.description}
                        </div>
                      </div>
                    </a>
                  </Button>
                );
              })}
            </CardContent>
          </Card>

          {/* 系统状态 */}
          <Card>
            <CardHeader>
              <CardTitle>系统状态</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">服务状态</span>
                <Badge
                  variant="secondary"
                  className="bg-green-100 text-green-800"
                >
                  正常运行
                </Badge>
              </div>
              <Separator className="my-3" />
              <div className="text-xs text-gray-500">
                最后更新：{new Date().toLocaleString('zh-CN')}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
