import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { exportToCSV, exportToJSON } from "@/lib/export";
import { FlaskConical } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'];

export default function StatisticsDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [startDate, setStartDate] = useState(() => {
    // 默认为 2024 年 11 月 1 日
    return '2024-11-01';
  });
  const [endDate, setEndDate] = useState(() => {
    // 默认为 2024 年 12 月 31 日
    return '2024-12-31';
  });

  const startDateTime = (() => {
    const [year, month, day] = startDate.split('-').map(Number);
    return new Date(year, month - 1, day, 0, 0, 0);
  })();
  const endDateTime = (() => {
    const [year, month, day] = endDate.split('-').map(Number);
    return new Date(year, month - 1, day, 23, 59, 59);
  })();

  // 获取统计数据
  const summaryQuery = trpc.statistics.summary.useQuery({
    startDate: startDateTime,
    endDate: endDateTime,
  });

  const labUsageQuery = trpc.statistics.labUsage.useQuery({
    startDate: startDateTime,
    endDate: endDateTime,
  });

  const userActivityQuery = trpc.statistics.userActivity.useQuery({
    startDate: startDateTime,
    endDate: endDateTime,
    limit: 10,
  });

  const timeDistributionQuery = trpc.statistics.timeDistribution.useQuery({
    startDate: startDateTime,
    endDate: endDateTime,
  });

  const statusStatisticsQuery = trpc.statistics.statusStatistics.useQuery({
    startDate: startDateTime,
    endDate: endDateTime,
  });

  if (user?.role !== 'admin') {
    setLocation('/');
    return null;
  }

  const summary = summaryQuery.data;
  const labUsageData = labUsageQuery.data || [];
  const userActivityData = userActivityQuery.data || [];
  const timeDistributionData = timeDistributionQuery.data || [];
  const statusStatisticsData = statusStatisticsQuery.data || [];

  const isLoading = summaryQuery.isLoading || labUsageQuery.isLoading;

  // 准备图表数据
  const statusChartData = statusStatisticsData.map(item => ({
    name: getStatusLabel(item.status),
    value: item.count || 0,
  }));

  // 准备用户活跃度排行数据
  const userActivityChartData = userActivityData.map(item => ({
    userId: `用户 ${item.userId}`,
    totalReservations: item.totalReservations || 0,
  }));

  function getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      cancelled: '已取消',
      completed: '已完成',
    };
    return statusMap[status] || status;
  }

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">数据统计分析</h2>
          <p className="text-gray-600">实验室使用情况、预约趋势和用户活跃度分析</p>
        </div>

        {/* 时间选择器和导出按钮 */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>查询时间范围</CardTitle>
          </CardHeader>
          <CardContent className="flex items-end gap-4 flex-wrap">
            <div>
              <Label>开始日期</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <Label>结束日期</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={() => { summaryQuery.refetch(); labUsageQuery.refetch(); userActivityQuery.refetch(); timeDistributionQuery.refetch(); statusStatisticsQuery.refetch(); }}>
                刷新数据
              </Button>
              <Button variant="outline" onClick={() => {
                if (labUsageData.length > 0) {
                  exportToCSV(labUsageData, `实验室使用统计_${startDate}_${endDate}`);
                }
              }}>
                导出实验室数据
              </Button>
              <Button variant="outline" onClick={() => {
                if (userActivityData.length > 0) {
                  exportToCSV(userActivityData, `用户活跃度_${startDate}_${endDate}`);
                }
              }}>
                导出用户数据
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 摘要卡片 */}
        {!isLoading && summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">总预约数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReservations || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">已通过</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{summary.approvedReservations || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">待审核</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600">{summary.pendingReservations || 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">参与用户数</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalUsers || 0}</div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* 图表区域 */}
        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* 预约状态分布 */}
            <Card>
              <CardHeader>
                <CardTitle>预约状态分布</CardTitle>
                <CardDescription>按状态统计预约数量</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, value }) => `${name}: ${value}`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {statusChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 预约时间趋势 */}
            <Card>
              <CardHeader>
                <CardTitle>预约时间趋势</CardTitle>
                <CardDescription>每日预约数量变化</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={timeDistributionData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="count" stroke="#8884d8" name="总预约数" />
                    <Line type="monotone" dataKey="approvedCount" stroke="#82ca9d" name="已通过" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 实验室使用率 */}
            <Card>
              <CardHeader>
                <CardTitle>实验室使用统计</CardTitle>
                <CardDescription>各实验室预约数和使用时长</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={labUsageData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="labName" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="totalReservations" fill="#8884d8" name="预约总数" />
                    <Bar dataKey="approvedReservations" fill="#82ca9d" name="已通过" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 用户活跃度排行 */}
            <Card>
              <CardHeader>
                <CardTitle>用户活跃度排行</CardTitle>
                <CardDescription>预约最活跃的用户 TOP 10</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={userActivityChartData}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="userId" type="category" width={90} />
                    <Tooltip />
                    <Bar dataKey="totalReservations" fill="#8884d8" name="预约数" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
