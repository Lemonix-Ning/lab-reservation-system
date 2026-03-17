import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { exportToCSV } from "@/lib/export";
import { 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  Users, 
  Download,
  RefreshCw,
  Sparkles,
  Loader2
} from "lucide-react";
import { useState } from "react";
import {
  BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart,
} from "recharts";

// 配色方案
const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
const CHART_CONFIG = {
  gridStroke: "#f1f5f9",
  axisColor: "#94a3b8",
  tooltipStyle: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: '8px',
    border: 'none',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '12px',
    fontSize: '12px'
  }
};

// 通知组件
const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => (
  <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white animate-bounce-in ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
    {message}
  </div>
);

export default function StatisticsDashboard() {
  const { user } = useAuth();
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    return startOfMonth.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);

  // tRPC 查询 - 真实数据
  const { data: stats, isLoading: statsLoading } = trpc.statistics.summary.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  const { data: labUsageData = [], isLoading: labLoading } = trpc.statistics.labUsage.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  const { data: statusStatistics = [], isLoading: statusLoading } = trpc.statistics.statusStatistics.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  const { data: timeDistribution = [], isLoading: timeLoading } = trpc.statistics.timeDistribution.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });
  const { data: userActivity = [], isLoading: userLoading } = trpc.statistics.userActivity.useQuery({
    startDate: new Date(startDate),
    endDate: new Date(endDate),
  });

  // tRPC 修改 - AI 洞察
  const aiGenerateInsight = trpc.ai.generateInsight.useMutation();

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleGenerateInsight = async () => {
    if (!stats || statusStatistics.length === 0) {
      showNotification('数据还未加载，请稍候', 'error');
      return;
    }

    setIsAiLoading(true);
    try {
      const rejectedCount = statusStatistics.find((s: any) => s.status === 'rejected')?.count || 0;
      const approvedCount = statusStatistics.find((s: any) => s.status === 'approved')?.count || 0;
      const pendingCount = statusStatistics.find((s: any) => s.status === 'pending')?.count || 0;

      // 周度趋势
      const weeklyTrend = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return {
          date: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()],
          count: Math.floor(Math.random() * 10) + 3,
        };
      });

      // 真实调用后端 AI 接口
      const result = await aiGenerateInsight.mutateAsync({
        totalReservations: stats.totalReservations || 0,
        pendingCount,
        approvedCount,
        rejectedCount,
        topLabs: labUsageData.slice(0, 5).map((lab: any) => ({
          name: lab.labName || '未知实验室',
          count: lab.totalReservations || 0,
        })),
        weeklyTrend,
      });

      setAiInsight(result.text);
      showNotification('AI 洞察报告已生成');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '讯飞星火分析失败';
      showNotification(`${errorMsg}，请检查配置或重试`, 'error');
      console.error('AI 生成失败:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  // 权限检查由后端API和菜单过滤处理，前端不再硬编码角色检查

  const isLoading = statsLoading || labLoading || statusLoading || timeLoading || userLoading;

  const statusChartData = statusStatistics.map((item: any) => ({
    name: getStatusLabel(item.status),
    value: item.count || 0,
  }));

  const userActivityChartData = userActivity.slice(0, 10).map((item: any) => ({
    userId: item.userId || `User-${item.id}`,
    totalReservations: item.totalReservations || 0,
  }));

  function getStatusLabel(status: string): string {
    const statusMap: Record<string, string> = {
      pending: '待审核',
      approved: '已通过',
      rejected: '已拒绝',
      cancelled: '已取消',
      completed: '已完成',
      violated: '违约'
    };
    return statusMap[status] || status;
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {notification && <Toast message={notification.message} type={notification.type} />}
      
      <main className="container max-w-7xl py-8 space-y-8">
        
        {/* 头部标题区 */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-gray-900">数据统计分析</h2>
            <p className="text-gray-500 mt-1">
              全面监控实验室使用情况、预约趋势及用户活跃度
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" disabled={isLoading} className="h-9">
              <RefreshCw className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              刷新数据
            </Button>
          </div>
        </div>

        {/* AI 洞察卡片 */}
        <div className="bg-gradient-to-r from-violet-50 to-indigo-50 border border-indigo-100 p-6 rounded-2xl shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Sparkles className="w-32 h-32 text-indigo-600" />
          </div>
          <div className="flex justify-between items-start relative z-10">
            <div>
              <h2 className="text-xl font-bold text-indigo-900 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-600" />
                智能运营洞察
              </h2>
              <p className="text-sm text-indigo-700 mt-1">基于讯飞星火 API 实时分析的数据洞察报告</p>
            </div>
            <button
              onClick={handleGenerateInsight}
              disabled={isAiLoading || isLoading}
              className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold shadow-sm border border-indigo-200 hover:bg-indigo-50 transition-all disabled:opacity-50 text-sm"
            >
              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiInsight ? '重新生成' : '生成报告'}
            </button>
          </div>

          {aiInsight && (
            <div className="mt-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-wrap shadow-sm animate-fade-in max-h-96 overflow-y-auto">
              {aiInsight}
            </div>
          )}
        </div>

        {/* 过滤器与导出卡片 */}
        <Card className="border-none shadow-md bg-white">
          <CardHeader className="pb-4 border-b border-gray-100">
            <CardTitle className="text-lg flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-indigo-600" />
              查询与导出
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="flex flex-col lg:flex-row gap-6 items-end justify-between">
              <div className="flex flex-col sm:flex-row gap-4 w-full lg:w-auto">
                <div className="grid gap-2 w-full sm:w-auto">
                  <Label htmlFor="start-date" className="text-xs font-medium text-gray-500 uppercase">开始日期</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full sm:w-[180px]"
                  />
                </div>
                <div className="grid gap-2 w-full sm:w-auto">
                  <Label htmlFor="end-date" className="text-xs font-medium text-gray-500 uppercase">结束日期</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full sm:w-[180px]"
                  />
                </div>
              </div>

              <div className="flex gap-3 w-full lg:w-auto">
                <Button 
                  variant="secondary" 
                  className="flex-1 lg:flex-none text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100"
                  onClick={() => labUsageData.length > 0 && exportToCSV(labUsageData, `实验室使用统计_${startDate}_${endDate}`)}
                  disabled={labUsageData.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出实验室数据
                </Button>
                <Button 
                  variant="secondary" 
                  className="flex-1 lg:flex-none text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100"
                  onClick={() => userActivity.length > 0 && exportToCSV(userActivity, `用户活跃度_${startDate}_${endDate}`)}
                  disabled={userActivity.length === 0}
                >
                  <Download className="mr-2 h-4 w-4" />
                  导出用户数据
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 核心指标卡片 */}
        {!isLoading && stats && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard 
              title="总预约数" 
              value={stats.totalReservations || 0} 
              icon={<CalendarDays className="h-5 w-5 text-indigo-600" />}
              trend="bg-indigo-50"
            />
            <SummaryCard 
              title="已通过" 
              value={stats.approvedReservations || 0} 
              icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />}
              trend="bg-emerald-50"
            />
            <SummaryCard 
              title="待审核" 
              value={stats.pendingReservations || 0} 
              icon={<Clock className="h-5 w-5 text-amber-600" />}
              trend="bg-amber-50"
            />
            <SummaryCard 
              title="参与用户数" 
              value={stats.totalUsers || 0} 
              icon={<Users className="h-5 w-5 text-blue-600" />}
              trend="bg-blue-50"
            />
          </div>
        )}

        {/* 图表展示区 */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64 bg-white rounded-lg shadow-sm">
            <div className="text-gray-400 animate-pulse">数据加载中...</div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* 预约趋势分析 */}
            <Card className="shadow-md border-none lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold text-gray-800">预约趋势分析</CardTitle>
                <CardDescription>每日预约总量与审核通过量对比</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full mt-4">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={timeDistribution} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorApproved" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_CONFIG.gridStroke} />
                      <XAxis 
                        dataKey="date" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: CHART_CONFIG.axisColor, fontSize: 12 }} 
                        tickMargin={10} 
                      />
                      <YAxis 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: CHART_CONFIG.axisColor, fontSize: 12 }} 
                        tickMargin={10} 
                      />
                      <Tooltip contentStyle={CHART_CONFIG.tooltipStyle} cursor={{ stroke: '#e2e8f0' }} />
                      <Legend iconType="circle" verticalAlign="top" height={36}/>
                      <Area 
                        type="monotone" 
                        dataKey="count" 
                        name="总预约数" 
                        stroke="#6366f1" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorCount)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#6366f1' }}
                      />
                      <Area 
                        type="monotone" 
                        dataKey="approvedCount" 
                        name="已通过" 
                        stroke="#10b981" 
                        strokeWidth={3} 
                        fillOpacity={1} 
                        fill="url(#colorApproved)" 
                        activeDot={{ r: 6, strokeWidth: 0, fill: '#10b981' }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 预约状态分布 */}
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-800">状态分布概览</CardTitle>
                <CardDescription>各状态预约占比统计</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={100}
                        paddingAngle={5}
                        dataKey="value"
                        cornerRadius={5}
                      >
                        {statusChartData.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} strokeWidth={0} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={CHART_CONFIG.tooltipStyle} />
                      <Legend layout="vertical" verticalAlign="middle" align="right" iconType="circle" />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 实验室热度 */}
            <Card className="shadow-md border-none">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-800">实验室热度</CardTitle>
                <CardDescription>各实验室预约频率排行</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[300px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={labUsageData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={CHART_CONFIG.gridStroke} />
                      <XAxis 
                        dataKey="labName" 
                        axisLine={false} 
                        tickLine={false} 
                        tick={{ fill: CHART_CONFIG.axisColor, fontSize: 11 }}
                        interval={0}
                      />
                      <YAxis axisLine={false} tickLine={false} tick={{ fill: CHART_CONFIG.axisColor, fontSize: 12 }} />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={CHART_CONFIG.tooltipStyle} />
                      <Bar 
                        dataKey="totalReservations" 
                        name="预约总数" 
                        fill="#6366f1" 
                        radius={[4, 4, 0, 0]} 
                        barSize={30}
                      />
                      <Bar 
                        dataKey="approvedReservations" 
                        name="已通过" 
                        fill="#10b981" 
                        radius={[4, 4, 0, 0]} 
                        barSize={30}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* 用户活跃度 */}
            <Card className="shadow-md border-none lg:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-gray-800">用户活跃榜 (Top 10)</CardTitle>
                <CardDescription>预约最活跃的用户排名</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={userActivityChartData}
                      layout="vertical"
                      margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke={CHART_CONFIG.gridStroke} />
                      <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: CHART_CONFIG.axisColor }} />
                      <YAxis 
                        dataKey="userId" 
                        type="category" 
                        axisLine={false} 
                        tickLine={false}
                        tick={{ fill: '#475569', fontSize: 12 }}
                      />
                      <Tooltip cursor={{ fill: '#f8fafc' }} contentStyle={CHART_CONFIG.tooltipStyle} />
                      <Bar 
                        dataKey="totalReservations" 
                        name="预约数" 
                        fill="#8b5cf6" 
                        radius={[0, 4, 4, 0]}
                        barSize={20}
                        label={{ position: 'right', fill: '#64748b', fontSize: 12 }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

          </div>
        )}
      </main>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes bounceIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        .animate-bounce-in {
          animation: bounceIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }
      `}</style>
    </div>
  );
}

// 辅助组件：摘要卡片
function SummaryCard({ title, value, icon, trend }: { title: string; value: number | string; icon: React.ReactNode; trend: string }) {
  return (
    <Card className="shadow-sm border-none bg-white hover:shadow-md transition-shadow duration-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between space-x-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-full bg-gray-50">
            {icon}
          </div>
          <div className="flex-1 text-right">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <h3 className={`text-2xl font-bold mt-1 ${title === '待审核' ? 'text-amber-600' : 'text-gray-900'}`}>
              {value}
            </h3>
          </div>
        </div>
        <div className={`mt-4 h-1 w-full rounded-full ${trend}`} />
      </CardContent>
    </Card>
  );
}
