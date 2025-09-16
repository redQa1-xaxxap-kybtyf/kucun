'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ArrowLeft, Edit, Building2, AlertCircle, Phone, MapPin, Mail, Globe, CreditCard, Tag, FileText, Store, User } from 'lucide-react'
import { getCustomer, customerQueryKeys } from '@/lib/api/customers'
import { 
  CUSTOMER_TYPE_LABELS, 
  CUSTOMER_TYPE_VARIANTS,
  CUSTOMER_LEVEL_LABELS,
  CUSTOMER_LEVEL_VARIANTS,
  CUSTOMER_FIELD_LABELS 
} from '@/lib/types/customer'
import { parseExtendedInfo } from '@/lib/validations/customer'

interface CustomerDetailPageProps {
  params: {
    id: string
  }
}

export default function CustomerDetailPage({ params }: CustomerDetailPageProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { id } = params

  // 获取客户详情
  const {
    data: customerData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: customerQueryKeys.detail(id),
    queryFn: () => getCustomer(id),
    enabled: !!session?.user?.id && !!id,
  })

  // 认证检查
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/signin')
    }
  }, [status, router])

  if (status === 'loading' || isLoading) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Skeleton className="h-10 w-20" />
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Skeleton className="h-64 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
            <div className="space-y-6">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-48 w-full" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return null
  }

  if (error) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">客户详情</h1>
              <p className="text-muted-foreground">查看客户的详细信息</p>
            </div>
          </div>

          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {error instanceof Error ? error.message : '获取客户信息失败'}
            </AlertDescription>
          </Alert>

          <div className="flex gap-2">
            <Button onClick={() => refetch()}>重试</Button>
            <Button variant="outline" onClick={() => router.push('/customers')}>
              返回客户列表
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!customerData?.data) {
    return (
      <div className="container mx-auto py-6">
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              返回
            </Button>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">客户详情</h1>
              <p className="text-muted-foreground">查看客户的详细信息</p>
            </div>
          </div>

          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>未找到指定的客户信息</AlertDescription>
          </Alert>

          <Button variant="outline" onClick={() => router.push('/customers')}>
            返回客户列表
          </Button>
        </div>
      </div>
    )
  }

  const customer = customerData.data
  const extendedInfo = parseExtendedInfo(customer.extendedInfo)

  // 获取客户类型图标
  const getCustomerTypeIcon = () => {
    switch (extendedInfo.customerType) {
      case 'company': return <Building2 className="h-5 w-5" />
      case 'store': return <Store className="h-5 w-5" />
      case 'individual': return <User className="h-5 w-5" />
      default: return <Building2 className="h-5 w-5" />
    }
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* 页面标题和操作 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="outline" size="sm" onClick={() => router.push('/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex items-center space-x-3">
            <div className="text-muted-foreground">
              {getCustomerTypeIcon()}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
              <div className="flex items-center space-x-2">
                {extendedInfo.customerType && (
                  <Badge variant={CUSTOMER_TYPE_VARIANTS[extendedInfo.customerType]}>
                    {CUSTOMER_TYPE_LABELS[extendedInfo.customerType]}
                  </Badge>
                )}
                {extendedInfo.level && (
                  <Badge variant={CUSTOMER_LEVEL_VARIANTS[extendedInfo.level]}>
                    {CUSTOMER_LEVEL_LABELS[extendedInfo.level]}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
        <Button onClick={() => router.push(`/customers/${customer.id}/edit`)}>
          <Edit className="h-4 w-4 mr-2" />
          编辑客户
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 主要信息 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 基础信息 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                基础信息
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">客户名称</label>
                  <p className="font-medium">{customer.name}</p>
                </div>
                
                {customer.phone && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center">
                      <Phone className="h-4 w-4 mr-1" />
                      联系电话
                    </label>
                    <p className="font-mono">{customer.phone}</p>
                  </div>
                )}

                {customer.parentCustomer && (
                  <div className="md:col-span-2">
                    <label className="text-sm font-medium text-muted-foreground">上级客户</label>
                    <p className="font-medium">{customer.parentCustomer.name}</p>
                  </div>
                )}
              </div>

              {customer.address && (
                <>
                  <Separator />
                  <div>
                    <label className="text-sm font-medium text-muted-foreground flex items-center">
                      <MapPin className="h-4 w-4 mr-1" />
                      客户地址
                    </label>
                    <p className="mt-1 text-sm leading-relaxed">{customer.address}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 扩展信息 */}
          {Object.keys(extendedInfo).length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>扩展信息</CardTitle>
                <CardDescription>客户的详细资料和业务信息</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* 联系信息 */}
                {(extendedInfo.email || extendedInfo.fax || extendedInfo.website) && (
                  <div>
                    <h4 className="text-sm font-medium mb-3">联系信息</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {extendedInfo.email && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground flex items-center">
                            <Mail className="h-4 w-4 mr-1" />
                            邮箱地址
                          </label>
                          <p className="font-mono text-sm">{extendedInfo.email}</p>
                        </div>
                      )}
                      
                      {extendedInfo.fax && (
                        <div>
                          <label className="text-sm font-medium text-muted-foreground">传真号码</label>
                          <p className="font-mono text-sm">{extendedInfo.fax}</p>
                        </div>
                      )}
                      
                      {extendedInfo.website && (
                        <div className="md:col-span-2">
                          <label className="text-sm font-medium text-muted-foreground flex items-center">
                            <Globe className="h-4 w-4 mr-1" />
                            网站地址
                          </label>
                          <a 
                            href={extendedInfo.website} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {extendedInfo.website}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* 业务信息 */}
                {(extendedInfo.businessLicense || extendedInfo.taxNumber || extendedInfo.bankAccount || 
                  extendedInfo.creditLimit || extendedInfo.paymentTerms || extendedInfo.industry || 
                  extendedInfo.region) && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="text-sm font-medium mb-3">业务信息</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {extendedInfo.businessLicense && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">营业执照号</label>
                            <p className="font-mono text-sm">{extendedInfo.businessLicense}</p>
                          </div>
                        )}
                        
                        {extendedInfo.taxNumber && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">税号</label>
                            <p className="font-mono text-sm">{extendedInfo.taxNumber}</p>
                          </div>
                        )}
                        
                        {extendedInfo.bankAccount && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">银行账户</label>
                            <p className="font-mono text-sm">{extendedInfo.bankAccount}</p>
                          </div>
                        )}
                        
                        {extendedInfo.creditLimit && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground flex items-center">
                              <CreditCard className="h-4 w-4 mr-1" />
                              信用额度
                            </label>
                            <p className="font-medium text-sm">¥{extendedInfo.creditLimit.toLocaleString()}</p>
                          </div>
                        )}
                        
                        {extendedInfo.paymentTerms && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">付款条件</label>
                            <p className="text-sm">{extendedInfo.paymentTerms}</p>
                          </div>
                        )}
                        
                        {extendedInfo.industry && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">所属行业</label>
                            <p className="text-sm">{extendedInfo.industry}</p>
                          </div>
                        )}
                        
                        {extendedInfo.region && (
                          <div>
                            <label className="text-sm font-medium text-muted-foreground">所在区域</label>
                            <p className="text-sm">{extendedInfo.region}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* 标签 */}
                {extendedInfo.tags && extendedInfo.tags.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center mb-3">
                        <Tag className="h-4 w-4 mr-1" />
                        客户标签
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {extendedInfo.tags.map((tag, index) => (
                          <Badge key={index} variant="secondary">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* 备注 */}
                {extendedInfo.notes && (
                  <>
                    <Separator />
                    <div>
                      <label className="text-sm font-medium text-muted-foreground flex items-center mb-2">
                        <FileText className="h-4 w-4 mr-1" />
                        备注信息
                      </label>
                      <p className="text-sm leading-relaxed bg-muted/50 p-3 rounded-md">
                        {extendedInfo.notes}
                      </p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* 侧边栏信息 */}
        <div className="space-y-6">
          {/* 客户状态 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">客户状态</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">创建时间</span>
                <span className="text-sm">
                  {new Date(customer.createdAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">更新时间</span>
                <span className="text-sm">
                  {new Date(customer.updatedAt).toLocaleDateString('zh-CN')}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 统计信息 */}
          {(customer.totalOrders !== undefined || customer.totalAmount !== undefined) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">交易统计</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {customer.totalOrders !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">订单总数</span>
                    <span className="font-medium">{customer.totalOrders}</span>
                  </div>
                )}
                {customer.totalAmount !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">交易总额</span>
                    <span className="font-medium text-green-600">¥{customer.totalAmount.toLocaleString()}</span>
                  </div>
                )}
                {customer.lastOrderDate && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">最后下单</span>
                    <span className="text-sm">
                      {new Date(customer.lastOrderDate).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* 子客户 */}
          {customer.childCustomers && customer.childCustomers.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">下级客户</CardTitle>
                <CardDescription>
                  共 {customer.childCustomers.length} 个下级客户
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {customer.childCustomers.slice(0, 5).map((child) => (
                    <div 
                      key={child.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/customers/${child.id}`)}
                    >
                      <span className="text-sm font-medium truncate">{child.name}</span>
                      <Badge variant="outline" className="text-xs">
                        {child.phone || '无电话'}
                      </Badge>
                    </div>
                  ))}
                  {customer.childCustomers.length > 5 && (
                    <div className="text-center pt-2">
                      <Button variant="outline" size="sm">
                        查看全部 {customer.childCustomers.length} 个
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
