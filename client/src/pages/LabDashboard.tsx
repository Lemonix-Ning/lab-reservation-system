import React from 'react';
import {
  CalendarCheck,
  AlertTriangle,
  Settings,
  Beaker,
  BarChart3,
  Users,
  Clock,
} from 'lucide-react';
import { useLocation } from 'wouter';
import { useAuth } from '@/_core/hooks/useAuth';

export default function LabDashboard() {
  const { user } = useAuth();
  const [, navigate] = useLocation();

  if (user === undefined) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-600">
        加载中...
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-700">
        请先登录后访问本系统
      </div>
    );
  }

  const isAdmin =  ['sysAdmin', 'labAdmin'].includes(user.role);

  // 顶部 4 个功能卡片
  const featureCards = [
    {
      key: 'online-reservation',
      title: '在线预约',
      desc: '即时预约实验室资源，实现高效协调',
      icon: CalendarCheck,
      color: 'text-blue-600',
    },
    {
      key: 'conflict-detection',
      title: '冲突检测',
      desc: '智能检测时间冲突，提高资源利用率',
      icon: AlertTriangle,
      color: 'text-green-600',
    },
    {
      key: 'rule-config',
      title: '规则配置',
      desc: '灵活配置预约规则，支持权限定制、时长',
      icon: Settings,
      color: 'text-purple-600',
    },
    {
      key: 'resource-management',
      title: '资源管理',
      desc: '统一管理学院实验室资源，可视化使用情',
      icon: Beaker,
      color: 'text-orange-600',
    },
  ];

  // 快速入口
  const quickLinks = [
    {
      key: 'labs',
      title: '浏览实验室',
      desc: '查看所有可用的实验室',
      icon: Beaker,
      path: '/labs',
    },
    {
      key: 'my-reservations',
      title: '我的预约',
      desc: '查看预约历史和当前预约',
      icon: CalendarCheck,
      path: '/my-reservations',
    },
    ...(isAdmin
      ? [
          {
            key: 'dashboard',
            title: 'AI 数据仪表板',
            desc: '查看统计数据、AI 分析报告',
            icon: BarChart3,
            path: '/admin/statistics',
          },
          {
            key: 'approval',
            title: '预约审核',
            desc: '审核学生的预约申请',
            icon: Users,
            path: '/admin/reservations',
          },
          {
            key: 'lab-manage',
            title: '实验室管理',
            desc: '管理实验室信息和资源',
            icon: Settings,
            path: '/admin/labs',
          },
          {
            key: 'rule-manage',
            title: '规则管理',
            desc: '配置预约相关规则',
            icon: Clock,
            path: '/admin/rules',
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* 标题区域 */}
      <div className="text-center py-12 px-4">
        <h1 className="text-4xl font-bold text-gray-900">
          高校实验室资源预约平台
        </h1>
        <p className="mt-2 text-gray-600">
          规范化管理、智能化调度，让实验室资源利用更高效
        </p>
      </div>

      {/* 主体内容 */}
      <main className="max-w-6xl mx-auto px-4 pb-12 space-y-12">
        {/* 4 个功能卡片 */}
        <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {featureCards.map((card) => (
            <div
              key={card.key}
              className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm hover:shadow-md transition"
            >
              <div className={`inline-flex p-3 rounded-full ${card.color} bg-opacity-10 mb-4`}>
                <card.icon className={`w-6 h-6 ${card.color}`} />
              </div>
              <h3 className="text-base font-semibold text-gray-900">{card.title}</h3>
              <p className="mt-2 text-sm text-gray-600">{card.desc}</p>
            </div>
          ))}
        </div>

        {/* 快速入口区域 */}
        <div className="bg-white rounded-lg border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">快速入口</h2>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {quickLinks.map((link) => (
              <button
                key={link.key}
                onClick={() => navigate(link.path)}
                type="button"
                className="text-left bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-300 rounded-lg p-4 transition group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1">
                    <link.icon className="w-5 h-5 text-blue-600 group-hover:text-blue-700" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 text-sm group-hover:text-blue-700">
                      {link.title}
                    </h3>
                    <p className="text-xs text-gray-600 mt-1">{link.desc}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
