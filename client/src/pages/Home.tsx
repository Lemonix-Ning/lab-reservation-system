import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getLoginUrl } from "@/const";
import { useRole } from "@/contexts/RoleContext";
import { BarChart3, Calendar, Clock, FlaskConical, Users, LayoutDashboard } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useEffect } from "react";

export default function Home() {
  const { user, isAuthenticated } = useAuth();
  const { isAdmin } = useRole();
  const [, setLocation] = useLocation();

  // 未登录时自动跳转到登录页
  useEffect(() => {
    if (!isAuthenticated) {
      setLocation("/login");
    }
  }, [isAuthenticated, setLocation]);

  return (
    <div className="bg-gradient-to-br from-blue-50 via-white to-purple-50 min-h-full -m-4 p-4">
      {/* 主内容 */}
      <main className="container py-12 mx-auto">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">
            学校实验室预约调度系统
          </h2>
          <p className="text-xl text-gray-600 mb-8">
            规范化管理，智能化调度，让实验室资源利用更高效
          </p>
        </div>

        {/* 功能特性 */}
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          <Card>
            <CardHeader>
              <Calendar className="h-10 w-10 text-blue-600 mb-2" />
              <CardTitle>在线预约</CardTitle>
              <CardDescription>
                随时随地提交实验室预约申请，实时查看预约状态
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="h-10 w-10 text-green-600 mb-2" />
              <CardTitle>冲突检测</CardTitle>
              <CardDescription>
                智能检测时间冲突，避免重复预约，提高资源利用率
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Users className="h-10 w-10 text-purple-600 mb-2" />
              <CardTitle>规则配置</CardTitle>
              <CardDescription>
                灵活配置预约规则，支持次数限制、时长限制等
              </CardDescription>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <FlaskConical className="h-10 w-10 text-orange-600 mb-2" />
              <CardTitle>资源管理</CardTitle>
              <CardDescription>
                统一管理实验室信息，可视化展示使用情况
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* 快速入口 */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-6">快速入口</h3>
          <div className="grid md:grid-cols-2 gap-4">
              <Link href="/labs">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <FlaskConical className="h-5 w-5" />
                      浏览实验室
                    </CardTitle>
                    <CardDescription>
                      查看所有可用实验室，提交预约申请
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              <Link href="/my-reservations">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" />
                      我的预约
                    </CardTitle>
                    <CardDescription>
                      查看和管理您的所有预约记录
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>

              {isAdmin && (
                <>
                  <Link href="/admin/statistics">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow border-2 border-blue-200 bg-blue-50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-blue-700">
                          <LayoutDashboard className="h-5 w-5" />
                          <BarChart3 className="h-5 w-5" />
                          AI 数据仪表板
                        </CardTitle>
                        <CardDescription>
                          查看统计数据、AI 智能洞察报告
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/admin/reservations">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          预约审核
                        </CardTitle>
                        <CardDescription>
                          审核待处理的预约申请
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>

                  <Link href="/admin/labs">
                    <Card className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <Clock className="h-5 w-5" />
                          实验室管理
                        </CardTitle>
                        <CardDescription>
                          管理实验室信息和开放时间
                        </CardDescription>
                      </CardHeader>
                    </Card>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>

      {/* 角色切换器已移至侧边栏 */}
    </div>
  );
}
