import React, { useState, useMemo } from 'react';
import {
  LayoutDashboard,
  FlaskConical,
  CalendarDays,
  Settings,
  LogOut,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  Search,
  User,
  Users,
  BarChart3,
  AlertCircle,
  Sparkles,
  Loader2,
  FileText,
  TrendingUp,
  Activity,
  CalendarCheck,
  Menu,
  X,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  AreaChart,
  Area,
} from 'recharts';
import { useAuth } from '@/_core/hooks/useAuth';
import { trpc } from '@/lib/trpc';

// Mock Data
const INITIAL_LABS = [
  { id: 1, name: '第一机房', building: '信息楼', room: '301', capacity: 60, type: '机房', status: 'enabled', image: '💻' },
  { id: 2, name: '基础化学实验室', building: '实验楼', room: '205', capacity: 40, type: '化学', status: 'enabled', image: '⚗️' },
  { id: 3, name: '高能物理实验室', building: '理学楼', room: '101', capacity: 30, type: '物理', status: 'disabled', image: '⚛️' },
  { id: 4, name: '人工智能实训室', building: '信息楼', room: '404', capacity: 45, type: '机房', status: 'enabled', image: '🤖' },
  { id: 5, name: '生物显微实验室', building: '实验楼', room: '308', capacity: 35, type: '生物', status: 'enabled', image: '🧬' },
];

const INITIAL_RESERVATIONS = [
  { id: 101, labId: 1, labName: '第一机房', userId: 1, userName: '张三', date: '2023-10-25', timeStart: '08:00', timeEnd: '10:00', reason: '完成数据结构作业', status: 'approved', submitTime: '2023-10-20 10:00' },
  { id: 102, labId: 2, labName: '基础化学实验室', userId: 1, userName: '张三', date: '2023-10-26', timeStart: '14:00', timeEnd: '16:00', reason: '有机化学补做实验', status: 'pending', submitTime: '2023-10-24 09:30' },
  { id: 103, labId: 1, labName: '第一机房', userId: 2, userName: '李四', date: '2023-10-25', timeStart: '08:00', timeEnd: '10:00', reason: 'Java课程设计', status: 'rejected', rejectReason: '该时段已有课程占用', submitTime: '2023-10-21 11:00' },
  { id: 104, labId: 4, labName: '人工智能实训室', userId: 3, userName: '王五', date: '2023-10-27', timeStart: '09:00', timeEnd: '12:00', reason: '模型训练', status: 'pending', submitTime: '2023-10-25 08:00' },
];

// Status Badge Component
const StatusBadge = ({ status }: { status: string }) => {
  const styles: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    approved: 'bg-green-100 text-green-800 border-green-200',
    rejected: 'bg-red-100 text-red-800 border-red-200',
    canceled: 'bg-gray-100 text-gray-800 border-gray-200',
    completed: 'bg-blue-100 text-blue-800 border-blue-200',
  };

  const labels: Record<string, string> = {
    pending: '待审核',
    approved: '已通过',
    rejected: '已拒绝',
    canceled: '已取消',
    completed: '已完成',
  };

  return (
    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status] || styles.pending}`}>
      {labels[status]}
    </span>
  );
};

// Notification Component
const Toast = ({ message, type }: { message: string; type: 'success' | 'error' }) => (
  <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white animate-bounce-in ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
    {message}
  </div>
);

export default function LabDashboard() {
  const { user } = useAuth();

  if (user === undefined) {
    return <div className="flex items-center justify-center h-screen">加载中...</div>;
  }

  if (!user) {
    return <div className="flex items-center justify-center h-screen">请先登录</div>;
  }

  return <LabDashboardContent user={user} />;
}

function LabDashboardContent({ user }: { user: any }) {
  // 开发模式角色切换
  const [devRole, setDevRole] = useState<'admin' | 'student' | null>(null);
  const [currentView, setCurrentView] = useState('dashboard');
  const [reservations, setReservations] = useState(INITIAL_RESERVATIONS);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [selectedLab, setSelectedLab] = useState<typeof INITIAL_LABS[0] | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // tRPC hooks - 获取实时数据
  const { data: labs = INITIAL_LABS, isLoading: labsLoading } = trpc.labRoom.list.useQuery();
  const { data: allReservations = [], isLoading: allReservationsLoading } = trpc.reservation.allList.useQuery();
  const { data: myReservations = [], isLoading: myReservationsLoading } = trpc.reservation.myList.useQuery();
  const utils = trpc.useUtils();

  // tRPC mutations
  const aiGenerateReason = trpc.ai.generateReason.useMutation();
  const aiGenerateInsight = trpc.ai.generateInsight.useMutation({
    onSuccess: () => {
      utils.reservation.allList.invalidate();
    },
  });

  const createReservation = trpc.reservation.create.useMutation({
    onSuccess: () => {
      utils.reservation.allList.invalidate();
      utils.reservation.myList.invalidate();
      setShowBookingModal(false);
      setReasonDraft('');
      showNotification('预约提交成功，请等待管理员审核');
    },
    onError: (error) => {
      showNotification(error.message || '预约创建失败', 'error');
    },
  });

  const approveReservation = trpc.reservation.approve.useMutation({
    onSuccess: () => {
      utils.reservation.allList.invalidate();
      showNotification('预约已通过');
    },
    onError: (error) => {
      showNotification(error.message || '批准失败', 'error');
    },
  });

  const rejectReservation = trpc.reservation.reject.useMutation({
    onSuccess: () => {
      utils.reservation.allList.invalidate();
      showNotification('预约已拒绝');
    },
    onError: (error) => {
      showNotification(error.message || '拒绝失败', 'error');
    },
  });

  // 同步后端数据到本地状态
  React.useEffect(() => {
    const displayReservations = user?.role === 'admin' ? allReservations : myReservations;
    const transformed = displayReservations.map((r: any) => ({
      id: r.id,
      labId: r.labId,
      labName: r.labRoom?.name || `Lab ${r.labId}`,
      userId: r.userId,
      userName: r.userId === user?.id ? (user?.name || 'User') : `User ${r.userId}`,
      date: r.startTime ? new Date(r.startTime).toISOString().split('T')[0] : '',
      timeStart: r.startTime ? new Date(r.startTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      timeEnd: r.endTime ? new Date(r.endTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : '',
      reason: r.reason || r.title || '',
      status: r.status,
      rejectReason: r.rejectReason,
      submitTime: r.applyTime ? new Date(r.applyTime).toLocaleString() : '',
    }));
    setReservations(transformed);
  }, [allReservations, myReservations, user]);

  // 开发模式：允许覆盖角色
  const currentRole = devRole || user.role;
  const isAdmin = currentRole === 'admin';
  const pendingCount = reservations.filter(r => r.status === 'pending').length;

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleGenerateReason = async () => {
    if (!reasonDraft.trim()) {
      showNotification('请先输入简单的关键词或原因', 'error');
      return;
    }
    setIsAiLoading(true);
    try {
      const result = await aiGenerateReason.mutateAsync({
        userInput: reasonDraft,
        labName: selectedLab?.name || '',
      });
      setReasonDraft(result.text);
      showNotification('✨ AI 润色完成！');
    } catch (error) {
      showNotification('讯飞星火 AI 生成失败，请检查配置或重试', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleGenerateDashboardInsight = async () => {
    setIsAiLoading(true);
    try {
      const approvedCount = reservations.filter(r => r.status === 'approved').length;
      const rejectedCount = reservations.filter(r => r.status === 'rejected').length;
      
      const labCounts = reservations.reduce((acc, r) => {
        acc[r.labName] = (acc[r.labName] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      const topLabs = Object.entries(labCounts)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
      
      const weeklyTrend = [
        { date: '周一', count: 3 },
        { date: '周二', count: 5 },
        { date: '周三', count: 4 },
        { date: '周四', count: 6 },
        { date: '周五', count: 8 },
        { date: '周六', count: 2 },
        { date: '周日', count: 1 },
      ];

      const result = await aiGenerateInsight.mutateAsync({
        totalReservations: reservations.length,
        pendingCount,
        approvedCount,
        rejectedCount,
        topLabs,
        weeklyTrend,
      });
      setAiInsight(result.text);
      showNotification('✨ 洞察报告已生成！');
    } catch (error) {
      showNotification('讯飞星火分析失败，请检查配置或重试', 'error');
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleBook = (lab: typeof INITIAL_LABS[0]) => {
    setSelectedLab(lab);
    setReasonDraft('');
    setShowBookingModal(true);
  };

  const submitBooking = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    const startTimeStr = formData.get('timeStart') as string;
    const endTimeStr = formData.get('timeEnd') as string;
    const dateStr = formData.get('date') as string;
    
    // 解析日期和时间
    const [startHour, startMin] = startTimeStr.split(':');
    const [endHour, endMin] = endTimeStr.split(':');
    
    const startTime = new Date(dateStr);
    startTime.setHours(parseInt(startHour), parseInt(startMin), 0);
    
    const endTime = new Date(dateStr);
    endTime.setHours(parseInt(endHour), parseInt(endMin), 0);
    
    createReservation.mutate({
      labId: selectedLab!.id,
      title: selectedLab!.name,
      reason: reasonDraft || (formData.get('reason') as string),
      startTime,
      endTime,
    });
  };

  const handleApprove = (id: number) => {
    approveReservation.mutate({ id });
  };

  const handleReject = (id: number) => {
    const reason = prompt('请输入拒绝原因：');
    if (reason) {
      rejectReservation.mutate({ id, rejectReason: reason });
    }
  };

  // Dashboard View
  const DashboardView = () => {
    const labUsageData = labs.map(lab => ({
      name: lab.name,
      count: reservations.filter(r => r.labId === lab.id && r.status === 'approved').length,
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    const statusData = [
      { name: '已通过', value: reservations.filter(r => r.status === 'approved').length },
      { name: '待审核', value: reservations.filter(r => r.status === 'pending').length },
      { name: '已拒绝', value: reservations.filter(r => r.status === 'rejected').length },
    ];

    const trendData = [
      { name: '周一', value: 12 },
      { name: '周二', value: 19 },
      { name: '周三', value: 15 },
      { name: '周四', value: 25 },
      { name: '周五', value: 32 },
      { name: '周六', value: 18 },
      { name: '周日', value: 8 },
    ];

    const COLORS = ['#10B981', '#FBBF24', '#EF4444'];

    if (isAdmin) {
      return (
        <div className="space-y-6 animate-fade-in pb-10">
          {/* AI Insight Section */}
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
                <p className="text-sm text-indigo-700 mt-1">基于讯飞星火 API 实时分析的运营报告</p>
              </div>
              <button
                onClick={handleGenerateDashboardInsight}
                disabled={isAiLoading}
                className="flex items-center gap-2 bg-white text-indigo-600 px-4 py-2 rounded-lg font-semibold shadow-sm border border-indigo-200 hover:bg-indigo-50 transition-all disabled:opacity-50 text-sm"
              >
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiInsight ? '重新生成' : '生成报告'}
              </button>
            </div>

            {aiInsight && (
              <div className="mt-4 bg-white/90 backdrop-blur-sm p-4 rounded-xl border border-indigo-100 text-gray-700 text-sm leading-relaxed whitespace-pre-line shadow-sm animate-fade-in">
                {aiInsight}
              </div>
            )}
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              { label: '总预约数', value: reservations.length, icon: CalendarCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: '待审核申请', value: pendingCount, icon: AlertCircle, color: 'text-amber-600', bg: 'bg-amber-50' },
              { label: '今日活跃', value: 12, icon: Activity, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: '实验室资源', value: labs.length, icon: FlaskConical, color: 'text-violet-600', bg: 'bg-violet-50' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 hover:shadow-md transition-all duration-300 group">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-gray-500 text-xs font-semibold uppercase tracking-wide">{stat.label}</p>
                    <h3 className="text-3xl font-bold text-gray-800 mt-2 group-hover:scale-105 transition-transform origin-left">{stat.value}</h3>
                  </div>
                  <div className={`p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-6 h-6" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Trend Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-gray-500" />
                  近七日预约流量趋势
                </h3>
              </div>
            </div>
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} />
                  <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                  <Area type="monotone" dataKey="value" stroke="#4F46E5" strokeWidth={3} fillOpacity={1} fill="url(#colorValue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bottom Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <h3 className="text-lg font-bold text-gray-800 mb-6">热门实验室 (Top 5)</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={labUsageData} layout="vertical" margin={{ top: 0, right: 30, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip cursor={{ fill: '#F3F4F6' }} />
                    <Bar dataKey="count" fill="#4F46E5" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <h3 className="text-lg font-bold text-gray-800 mb-2">预约状态分布</h3>
              <div className="flex-1 min-h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      fill="#8884d8"
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {statusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend verticalAlign="bottom" height={36} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Student Dashboard
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white shadow-lg relative overflow-hidden">
          <div className="relative z-10">
            <h1 className="text-3xl font-bold mb-2">欢迎回来, {user.name}同学</h1>
            <p className="opacity-90">今天是 {new Date().toLocaleDateString()}。你当前有 <span className="font-bold underline text-xl">{reservations.filter(r => r.userId === user.id && r.status === 'pending').length}</span> 个待审核的预约。</p>
            <button
              onClick={() => setCurrentView('labs')}
              className="mt-6 bg-white text-blue-700 px-6 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors shadow-md flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              立即预约实验室
            </button>
          </div>
          <FlaskConical className="absolute right-0 bottom-0 text-white opacity-10 w-48 h-48 transform translate-x-10 translate-y-10" />
        </div>

        <h3 className="text-xl font-bold text-gray-800 mt-8 mb-4">我的近期预约</h3>
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {reservations.filter(r => r.userId === user.id).length === 0 ? (
            <div className="p-8 text-center text-gray-500">暂无预约记录</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                  <tr>
                    <th className="p-4">实验室</th>
                    <th className="p-4">日期</th>
                    <th className="p-4">时间段</th>
                    <th className="p-4">状态</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {reservations.filter(r => r.userId === user.id).slice(0, 3).map(r => (
                    <tr key={r.id} className="hover:bg-gray-50">
                      <td className="p-4 font-medium">{r.labName}</td>
                      <td className="p-4">{r.date}</td>
                      <td className="p-4">{r.timeStart} - {r.timeEnd}</td>
                      <td className="p-4"><StatusBadge status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Labs View
  const LabsView = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('all');

    const filteredLabs = labs.filter(lab =>
      (typeFilter === 'all' || lab.type === typeFilter) &&
      (lab.name.includes(searchTerm) || (lab.building?.includes(searchTerm) ?? false))
    );

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="搜索实验室名称、楼宇..."
              className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2 w-full md:w-auto overflow-x-auto">
            {['all', '机房', '化学', '物理', '生物'].map(type => (
              <button
                key={type}
                onClick={() => setTypeFilter(type)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  typeFilter === type
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {type === 'all' ? '全部类型' : type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLabs.map(lab => (
            <div key={lab.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow">
              <div className="h-32 bg-gray-100 flex items-center justify-center text-4xl">
                {'image' in lab ? lab.image : '🧪'}
              </div>
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h3 className="font-bold text-lg text-gray-800">{lab.name}</h3>
                    <p className="text-sm text-gray-500">{lab.building || ('location' in lab ? lab.location : '') || ''} {'room' in lab ? lab.room : ''}</p>
                  </div>
                  <span className={`px-2 py-1 text-xs rounded-md ${lab.status === 'enabled' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {lab.status === 'enabled' ? '开放中' : '维护中'}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-4 text-sm text-gray-600">
                  <div className="flex items-center gap-1">
                    <Users className="w-4 h-4" />
                    <span>{lab.capacity || 0}人</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <FlaskConical className="w-4 h-4" />
                    <span>{lab.type || '实验室'}</span>
                  </div>
                </div>

                <button
                  onClick={() => handleBook(lab as any)}
                  disabled={lab.status !== 'enabled' || isAdmin}
                  className={`w-full mt-6 py-2 rounded-lg font-semibold flex items-center justify-center gap-2 transition-colors ${
                    lab.status === 'enabled'
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  {isAdmin ? '编辑详情' : '立即预约'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  // Reservations View
  const ReservationsView = () => {
    const isStudent = !isAdmin;
    const displayList = isStudent
      ? reservations.filter(r => r.userId === user.id)
      : reservations;

    return (
      <div className="space-y-6 animate-fade-in">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-bold text-gray-800">{isStudent ? '我的预约记录' : '预约审核管理'}</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                <tr>
                  <th className="p-4">预约ID</th>
                  {!isStudent && <th className="p-4">申请人</th>}
                  <th className="p-4">实验室</th>
                  <th className="p-4">预约时间</th>
                  <th className="p-4 w-48">事由</th>
                  <th className="p-4">状态</th>
                  <th className="p-4 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {displayList.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50">
                    <td className="p-4 font-mono text-gray-500">#{r.id}</td>
                    {!isStudent && (
                      <td className="p-4">
                        <div className="font-medium">{r.userName}</div>
                        <div className="text-xs text-gray-500">{r.userId}</div>
                      </td>
                    )}
                    <td className="p-4">
                      <div className="font-medium">{r.labName}</div>
                    </td>
                    <td className="p-4">
                      <div className="font-medium">{r.date}</div>
                      <div className="text-xs text-gray-500">{r.timeStart} - {r.timeEnd}</div>
                    </td>
                    <td className="p-4 text-gray-600 truncate max-w-xs" title={r.reason}>{r.reason}</td>
                    <td className="p-4"><StatusBadge status={r.status} /></td>
                    <td className="p-4 text-right">
                      {isStudent ? (
                        r.status === 'pending' && (
                          <button
                            className="text-red-600 hover:text-red-800 hover:bg-red-50 px-3 py-1 rounded-md text-xs font-medium transition-colors"
                          >
                            取消
                          </button>
                        )
                      ) : (
                        r.status === 'pending' ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(r.id)}
                              className="text-green-600 hover:bg-green-50 p-1.5 rounded-md transition-colors"
                              title="通过"
                            >
                              <CheckCircle2 className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleReject(r.id)}
                              className="text-red-600 hover:bg-red-50 p-1.5 rounded-md transition-colors"
                              title="拒绝"
                            >
                              <XCircle className="w-5 h-5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {displayList.length === 0 && (
              <div className="p-12 text-center text-gray-400">没有找到相关记录</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-gray-50">
      {notification && <Toast message={notification.message} type={notification.type} />}

      {/* Booking Modal */}
      {showBookingModal && selectedLab && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-scale-in">
            <div className="px-6 py-4 border-b bg-gray-50 flex justify-between items-center">
              <h3 className="font-bold text-lg">预约 {selectedLab.name}</h3>
              <button onClick={() => setShowBookingModal(false)} className="text-gray-400 hover:text-gray-600">
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={submitBooking} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">预约日期</label>
                <input required type="date" name="date" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">开始时间</label>
                  <input required type="time" name="timeStart" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">结束时间</label>
                  <input required type="time" name="timeEnd" className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-sm font-medium text-gray-700">预约事由</label>
                  <button
                    type="button"
                    onClick={handleGenerateReason}
                    disabled={isAiLoading}
                    className="flex items-center gap-1.5 text-xs text-purple-600 hover:text-purple-700 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded transition-colors disabled:opacity-50"
                  >
                    {isAiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                    AI 润色 (讯飞星火)
                  </button>
                </div>
                <textarea
                  required
                  name="reason"
                  rows={3}
                  value={reasonDraft}
                  onChange={(e) => setReasonDraft(e.target.value)}
                  placeholder="请输入简单的关键词，例如：'数据结构作业'，然后点击 AI 润色"
                  className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                ></textarea>
                <p className="text-xs text-gray-400 mt-1">AI 润色可以帮助您生成更专业的预约理由，提高审核通过率。</p>
              </div>

              <div className="pt-2">
                <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-semibold hover:bg-blue-700 transition-colors">
                  提交申请
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="h-full overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {currentView === 'dashboard' && <DashboardView />}
          {currentView === 'labs' && <LabsView />}
          {currentView === 'reservations' && <ReservationsView />}
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95); }
          to { opacity: 1; transform: scale(1); }
        }
        .animate-fade-in {
          animation: fadeIn 0.4s ease-out;
        }
        .animate-scale-in {
          animation: scaleIn 0.3s ease-out;
        }
        .animate-bounce-in {
          animation: scaleIn 0.3s cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }
      `}</style>
    </div>
  );
}
