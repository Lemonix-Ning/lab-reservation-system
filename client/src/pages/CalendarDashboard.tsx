'use client';

import React, { useState, useEffect } from 'react';
import { Calendar } from '@/components/Calendar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  AlertCircle, 
  TrendingUp, 
  FileText, 
  CheckCircle, 
  XCircle, 
  Calendar as CalendarIcon, 
  Monitor, 
  BookOpen, 
  Filter,
  Clock,
  MapPin,
  User,
  LayoutGrid,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Download
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns';
import { trpc } from '@/lib/trpc';
import { skipToken, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/_core/hooks/useAuth';
import { useIsMobile } from '@/hooks/useMobile';
import { exportToICalendar, exportToHTML } from '@/lib/export';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface CalendarEvent {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  labName?: string;
  labId?: number;
  courseId?: number;
  conflictCount?: number;
  applicantName?: string;
  peopleCount?: number;
  reason?: string;
}

interface AlternativeSlot {
  startTime: Date;
  endTime: Date;
  availableCapacity: number;
  confidence: number;
}

export default function CalendarPage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewType, setViewType] = useState<'day' | 'week' | 'month' | 'heatmap'>('month');
  const [dimension, setDimension] = useState<'lab' | 'device' | 'course'>('lab');
  const [selectedLab, setSelectedLab] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<number | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<number | null>(null);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [alternativeSlots, setAlternativeSlots] = useState<AlternativeSlot[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showConflictsOnly, setShowConflictsOnly] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  const queryClient = useQueryClient();
  const { data: labsData } = trpc.labRoom.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 60, // 1小时缓存
    gcTime: 1000 * 60 * 60 * 2  // 2小时垃圾回收
  });
  const { data: devicesData } = trpc.device.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 60, 
    gcTime: 1000 * 60 * 60 * 2 
  });
  const { data: coursesData } = trpc.course.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 30, // 30分钟缓存
    gcTime: 1000 * 60 * 60 
  });

  // 获取选中事件的完整详情
  const { data: reservationDetails, refetch: refetchDetails } = trpc.calendar.getReservationDetails.useQuery(
    selectedEvent ? { reservationId: selectedEvent.id } : skipToken
  );

  // 获取冲突建议（当选中的事件有冲突时）
  const { data: conflictSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = trpc.calendar.getConflictSuggestions.useQuery(
    selectedEvent && reservationDetails ? {
      labId: reservationDetails.labId ?? 0,
      startTime: reservationDetails.startTime ? new Date(reservationDetails.startTime).toISOString() : new Date().toISOString(),
      endTime: reservationDetails.endTime ? new Date(reservationDetails.endTime).toISOString() : new Date().toISOString(),
      excludeReservationId: selectedEvent.id ?? 0,
    } : skipToken,
    {
      enabled: false,
    }
  );

  // 快速操作 mutations
  const approveMutation = trpc.reservation.approve.useMutation();
  const rejectMutation = trpc.reservation.reject.useMutation();
  const cancelMutation = trpc.reservation.cancel.useMutation();
  const updateMutation = trpc.reservation.update.useMutation();

  // 获取冲突详情
  const { data: conflictDetails } = trpc.reservation.getConflictDetails.useQuery(
    selectedEvent ? { reservationId: selectedEvent.id } : skipToken
  );

  // 获取所有冲突的预约（仅管理员）
  const isAdmin = user?.role === 'labAdmin' || user?.role === 'sysAdmin';
  const conflictQueryParams = showConflictsOnly && isAdmin
    ? {
        startDate: startOfMonth(currentDate).toISOString(),
        endDate: endOfMonth(currentDate).toISOString(),
        labId: dimension === 'lab' && selectedLab ? selectedLab : undefined,
        status: (statusFilter as "pending" | "approved" | "rejected" | "cancelled" | "completed" | "violated" | undefined) || undefined,
      }
    : skipToken;
  
  const { data: conflictingReservations, isLoading: conflictsLoading, error: conflictsError } = trpc.calendar.getConflictingReservations.useQuery(
    conflictQueryParams,
    { staleTime: 1000 * 60 * 5 } // 5分钟缓存冲突检测结果
  );

  // 根据维度调用不同的 API
  // 注意：日历数据按日期分组缓存，同一日期的查询将复用缓存
  const { data: labCalendarData, isLoading: labCalendarLoading } = trpc.calendar.getLabCalendar.useQuery(
    dimension === 'lab' && selectedLab
      ? {
          labId: selectedLab,
          startDate: startOfMonth(currentDate).toISOString(),
          endDate: endOfMonth(currentDate).toISOString(),
          viewType: viewType,
        }
      : skipToken,
    { staleTime: 1000 * 60 * 10, gcTime: 1000 * 60 * 30 } // 10分钟缓存，30分钟回收
  );

  const { data: deviceCalendarData, isLoading: deviceCalendarLoading } = trpc.calendar.getDeviceCalendar.useQuery(
    dimension === 'device' && selectedDevice
      ? {
          deviceId: selectedDevice,
          startDate: startOfMonth(currentDate).toISOString(),
          endDate: endOfMonth(currentDate).toISOString(),
          viewType: viewType,
        }
      : skipToken,
    { staleTime: 1000 * 60 * 10, gcTime: 1000 * 60 * 30 }
  );

  const { data: courseCalendarData, isLoading: courseCalendarLoading } = trpc.calendar.getAllCourseCalendar.useQuery(
    dimension === 'course' && selectedCourse
      ? {
          courseId: selectedCourse,
          startDate: startOfMonth(currentDate).toISOString(),
          endDate: endOfMonth(currentDate).toISOString(),
        }
      : skipToken,
    { staleTime: 1000 * 60 * 10, gcTime: 1000 * 60 * 30 }
  );

  const calendarData = dimension === 'lab' 
    ? labCalendarData 
    : dimension === 'device' 
    ? deviceCalendarData 
    : courseCalendarData;
  const calendarLoading = dimension === 'lab' 
    ? labCalendarLoading 
    : dimension === 'device' 
    ? deviceCalendarLoading 
    : courseCalendarLoading;

  const labs = labsData || [];
  const devices = devicesData || [];
  const courses = coursesData || [];
  const hasSelection = (dimension === 'lab' && selectedLab) || (dimension === 'device' && selectedDevice) || (dimension === 'course' && selectedCourse);

  // 获取月度资源利用率数据（用于热力图）
  const { data: utilizationData, isLoading: utilizationLoading } = trpc.calendar.getMonthlyUtilization.useQuery(
    viewType === 'heatmap' && hasSelection
      ? {
          labId: dimension === 'lab' && selectedLab ? selectedLab : undefined,
          deviceId: dimension === 'device' && selectedDevice ? selectedDevice : undefined,
          courseId: dimension === 'course' && selectedCourse ? selectedCourse : undefined,
          startDate: startOfMonth(currentDate).toISOString(),
          endDate: endOfMonth(currentDate).toISOString(),
        }
      : skipToken,
    { staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 } // 热力图数据变化不频繁，缓存15分钟
  );

  // 前端冲突检测（用于 UI 显示）
  const checkEventConflict = (event: CalendarEvent): boolean => {
    return events.some(otherEvent => {
      if (otherEvent.id === event.id) return false;
      if (otherEvent.status !== 'approved' && otherEvent.status !== 'pending') return false;
      const overlap = !(event.endTime <= otherEvent.startTime || event.startTime >= otherEvent.endTime);
      return overlap;
    });
  };

  // 维度切换时清理无关选择，并在设备/课程维度自动选择第一项（若为空且有数据）
  useEffect(() => {
    if (dimension === 'lab') {
      setSelectedDevice(null);
      setSelectedCourse(null);
    } else if (dimension === 'device') {
      setSelectedLab(null);
      if (selectedDevice === null && devices.length > 0) {
        setSelectedDevice(devices[0].id);
      }
    } else if (dimension === 'course') {
      setSelectedLab(null);
      setSelectedDevice(null);
      if (selectedCourse === null && courses.length > 0) {
        setSelectedCourse(courses[0].id);
      }
    }
  }, [dimension, devices, courses]);

  // 当获取到冲突建议时，自动更新并显示
  useEffect(() => {
    if (conflictSuggestions && conflictSuggestions.length > 0) {
      setAlternativeSlots(conflictSuggestions.map((slot: any) => ({
        ...slot,
        startTime: new Date(slot.startTime),
        endTime: new Date(slot.endTime),
      })));
    }
  }, [conflictSuggestions]);

  useEffect(() => {
    // 如果开启冲突筛选，使用冲突数据
    if (showConflictsOnly && conflictingReservations) {
      console.log('[Frontend] Using conflict data:', conflictingReservations.length, 'items');
      const convertedEvents = conflictingReservations.map((e: any) => ({
        id: e.id,
        title: e.title,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
        status: e.status,
        labId: e.lab?.id,
        labName: e.lab?.name,
        applicantName: e.applicant?.name,
        peopleCount: e.peopleCount,
        reason: e.reason,
        conflictCount: e.conflictCount,
      }));
      setEvents(convertedEvents);
      return;
    }

    // 否则使用普通日历数据
    if (calendarData?.events) {
      let convertedEvents = calendarData.events.map((e: any) => ({
        ...e,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
      }));

      // 去重处理（基于事件 ID）
      const uniqueEvents = convertedEvents.reduce((acc: CalendarEvent[], current: CalendarEvent) => {
        const exists = acc.find(e => e.id === current.id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

      // 应用状态过滤
      const filteredEvents = statusFilter 
        ? uniqueEvents.filter((e: CalendarEvent) => e.status === statusFilter)
        : uniqueEvents;

      setEvents(filteredEvents);
    } else {
      setEvents([]);
    }
  }, [calendarData, statusFilter, showConflictsOnly, conflictingReservations]);

  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setAlternativeSlots([]); // 切换事件时清空上一次的建议
  };

  const handleConflictCheck = async () => {
    // 显式拉取替代方案，避免按钮点击后无感知
    if (!selectedEvent) return;

    let details = reservationDetails;
    if (!details) {
      const detailsResult = await refetchDetails();
      details = detailsResult.data;
    }

    if (!details) {
      toast.warning('预约详情仍在加载，请稍后重试');
      return;
    }

    try {
      const result = await refetchSuggestions();
      const slots = result.data || [];
      if (!slots.length) {
        setAlternativeSlots([]);
        toast.info('当前未找到可用的建议方案，请尝试调整筛选条件或时间段');
      }
    } catch (error: any) {
      toast.error('获取建议方案失败：' + (error.message || '未知错误'));
    }
  };

  const handleApprove = async () => {
    if (!selectedEvent) return;
    try {
      await approveMutation.mutateAsync({ id: selectedEvent.id });
      setSelectedEvent(null); // 关闭模态框
      // 刷新所有相关查询
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false }),
      ]);
    } catch (error: any) {
      toast.error('操作失败：' + (error.message || '未知错误'));
    }
  };

  const handleReject = async () => {
    if (!selectedEvent) return;
    const reason = prompt('请输入拒绝原因：');
    if (!reason) return;
    try {
      await rejectMutation.mutateAsync({ id: selectedEvent.id, rejectReason: reason });
      setSelectedEvent(null); // 关闭模态框
      // 刷新所有相关查询
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false }),
      ]);
    } catch (error: any) {
      toast.error('操作失败：' + (error.message || '未知错误'));
    }
  };

  const handleCancel = async () => {
    if (!selectedEvent) return;
    if (!confirm('确定要取消此预约吗？')) return;
    try {
      await cancelMutation.mutateAsync({ id: selectedEvent.id });
      setSelectedEvent(null); // 关闭模态框
      // 刷新所有相关查询
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false }),
      ]);
    } catch (error: any) {
      toast.error('操作失败：' + (error.message || '未知错误'));
    }
  };

  // 导出为 HTML 格式（可直接查看）
  const handleExportCalendar = (exportFormat: 'html' | 'ics' | 'pdf' = 'ics') => {
    if (events.length === 0) {
      toast.info('当前没有可导出的预约事件');
      return;
    }

    // 准备导出数据（导出所有状态的事件，因为导出格式可以直接查看）
    const exportEvents = events.map(event => ({
      id: event.id,
      title: event.title,
      startTime: event.startTime,
      endTime: event.endTime,
      description: event.reason || '',
      location: event.labName || '',
      status: event.status,
      applicantName: event.applicantName,
      reason: event.reason,
    }));

    // 生成文件名和标题
    const dateStr = format(currentDate, 'yyyy-MM');
    const dimensionStr = dimension === 'lab' ? '实验室' : dimension === 'device' ? '设备' : '课程';
    const resourceName = dimension === 'lab' && selectedLab
      ? labs.find(l => l.id === selectedLab)?.name || ''
      : dimension === 'device' && selectedDevice
      ? devices.find(d => d.id === selectedDevice)?.name || ''
      : dimension === 'course' && selectedCourse
      ? courses.find(c => c.id === selectedCourse)?.name || ''
      : '全部';
    
    const filename = `预约日历_${dimensionStr}_${resourceName}_${dateStr}`.replace(/[\/\\:*?"<>|]/g, '_');
    const title = `预约日历 - ${dimensionStr} - ${resourceName}`;
    const subtitle = `${dateStr} | 共 ${exportEvents.length} 个预约`;

    // 根据选择的格式导出
    if (exportFormat === 'ics') {
      exportToICalendar(exportEvents, filename);
    } else if (exportFormat === 'pdf') {
      // 打印为 PDF：先生成 HTML，然后打开打印对话框
      exportToHTML(exportEvents, filename, { title, subtitle });
      // 延迟后打开打印对话框
      setTimeout(() => window.print(), 500);
    } else {
      exportToHTML(exportEvents, filename, { title, subtitle });
    }
  };

  const handleApplyAlternativeSlot = async (slot: AlternativeSlot, bypassAdvanceRule = false) => {
    if (!selectedEvent || !reservationDetails) return;
    
    const isAdmin = user?.role === 'labAdmin' || user?.role === 'sysAdmin';
    const slotTimeStr = `${format(slot.startTime, 'yyyy/MM/dd HH:mm')} - ${format(slot.endTime, 'HH:mm')}`;
    
    // 管理员可以选择绕过提前预约规则
    let confirmMsg = `确定要将预约改为 ${slotTimeStr} 吗？\n\n注意：修改时间后预约将重新进入待审核状态。`;
    
    if (isAdmin && !bypassAdvanceRule) {
      confirmMsg += '\n\n您是管理员，如果此时间不符合提前预约规则，可以点击"取消"，然后使用"绕过规则"选项。';
    }
    
    if (!confirm(confirmMsg)) {
      return;
    }

    try {
      const result = await updateMutation.mutateAsync({
        id: selectedEvent.id,
        startTime: slot.startTime,
        endTime: slot.endTime,
        bypassAdvanceRule, // 传递绕过参数
      });
      
      if (result.needsReApproval) {
        toast.success('预约时间已更新，状态已改为待审核，请等待管理员审批。' + (bypassAdvanceRule ? '（已使用管理员权限绕过提前预约规则）' : ''));
      } else {
        toast.success('预约时间已更新成功');
      }
      
      setSelectedEvent(null);
      // 刷新所有相关查询 - 使用 exact: false 确保包含所有子查询
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false }),
      ]);
    } catch (error: any) {
      toast.error('更新失败：' + (error.message || '未知错误'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50/50 pb-12">
      {/* 顶部横幅 */}
      <div className="bg-white border-b border-gray-200 px-6 py-5 sticky top-0 z-20 backdrop-blur-md bg-white/80">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
              <CalendarIcon className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">日历与调度</h1>
              <p className="text-xs text-gray-500 mt-0.5">可视化管理实验室资源与预约排期</p>
            </div>
          </div>
          
          {hasSelection && (
            <div className="flex items-center bg-gray-100 rounded-lg p-1">
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setCurrentDate(subMonths(currentDate, 1))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium px-3 min-w-[100px] text-center">
                {format(currentDate, 'yyyy年 MM月')}
              </span>
              <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md" onClick={() => setCurrentDate(addMonths(currentDate, 1))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-12 gap-6">
          {/* 左侧控制栏 */}
          <div className="col-span-12 lg:col-span-3 space-y-6">
            <Card className="rounded-2xl border-gray-200 shadow-sm overflow-hidden">
              <CardHeader className="bg-gray-50/50 pb-4">
                <CardTitle className="text-base font-semibold text-gray-900 flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-500" />
                  视图配置
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">查看维度</label>
                  <div className="flex p-1 bg-gray-100 rounded-xl">
                    <button 
                      onClick={() => setDimension('lab')} 
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                        dimension === 'lab' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <LayoutGrid className="w-3.5 h-3.5" /> 实验室
                    </button>
                    <button 
                      onClick={() => setDimension('device')} 
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                        dimension === 'device' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <Monitor className="w-3.5 h-3.5" /> 设备
                    </button>
                    <button 
                      onClick={() => setDimension('course')} 
                      className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-lg transition-all ${
                        dimension === 'course' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      <BookOpen className="w-3.5 h-3.5" /> 课程
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    选择{dimension === 'lab' ? '实验室' : dimension === 'device' ? '设备' : '课程'}
                  </label>
                  {dimension === 'lab' && (
                    <Select value={selectedLab ? String(selectedLab) : ''} onValueChange={(val) => setSelectedLab(val ? Number(val) : null)}>
                      <SelectTrigger className="w-full bg-gray-50 border-gray-200 rounded-xl">
                        <SelectValue placeholder="请选择实验室" />
                      </SelectTrigger>
                      <SelectContent>
                        {labs.map((lab: any) => (
                          <SelectItem key={lab.id} value={String(lab.id)}>{lab.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {dimension === 'device' && (
                    <Select value={selectedDevice ? String(selectedDevice) : ''} onValueChange={(val) => setSelectedDevice(val ? Number(val) : null)}>
                      <SelectTrigger className="w-full bg-gray-50 border-gray-200 rounded-xl">
                        <SelectValue placeholder="请选择设备" />
                      </SelectTrigger>
                      <SelectContent>
                        {devices.map((device: any) => (
                          <SelectItem key={device.id} value={String(device.id)}>{device.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  {dimension === 'course' && (
                    <Select value={selectedCourse ? String(selectedCourse) : ''} onValueChange={(val) => setSelectedCourse(val ? Number(val) : null)}>
                      <SelectTrigger className="w-full bg-gray-50 border-gray-200 rounded-xl">
                        <SelectValue placeholder="请选择课程" />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((course: any) => (
                          <SelectItem key={course.id} value={String(course.id)}>{course.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <Separator />

                <div className="space-y-3">
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">筛选</label>
                  <div className="grid gap-3">
                    <Input 
                      type="date" 
                      className="bg-gray-50 border-gray-200 rounded-xl" 
                      value={format(currentDate, 'yyyy-MM-dd')} 
                      onChange={(e) => setCurrentDate(new Date(e.target.value))} 
                    />
                    <Select value={statusFilter || 'all'} onValueChange={(val) => setStatusFilter(val === 'all' ? null : val)}>
                      <SelectTrigger className="bg-gray-50 border-gray-200 rounded-xl">
                        <SelectValue placeholder="全部状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="pending">待审核</SelectItem>
                        <SelectItem value="approved">已批准</SelectItem>
                        <SelectItem value="rejected">已拒绝</SelectItem>
                        <SelectItem value="completed">已完成</SelectItem>
                        <SelectItem value="cancelled">已取消</SelectItem>
                      </SelectContent>
                    </Select>
                    
                    {/* 冲突筛选按钮（仅管理员可见） */}
                    {isAdmin && (
                      <div className="space-y-2">
                        <Button
                          variant={showConflictsOnly ? "default" : "outline"}
                          className={`w-full rounded-xl ${
                            showConflictsOnly 
                              ? 'bg-red-500 hover:bg-red-600 text-white' 
                              : 'border-gray-200 hover:bg-red-50 hover:border-red-200 hover:text-red-600'
                          }`}
                          onClick={() => setShowConflictsOnly(!showConflictsOnly)}
                        >
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {showConflictsOnly ? '显示全部预约' : '仅显示冲突'}
                        </Button>
                        {showConflictsOnly && (
                          <div className="text-xs text-gray-500 bg-blue-50 border border-blue-100 rounded-lg p-2">
                            <strong>提示：</strong>可选择特定实验室筛选，或查看全部实验室的冲突
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 统计卡片 */}
            {showConflictsOnly && conflictingReservations ? (
              <div className="grid grid-cols-1 gap-3">
                <Card className="rounded-2xl border-red-200 bg-red-50 shadow-sm p-4 flex flex-col justify-center items-center">
                  <div className="text-xs text-red-600 font-medium mb-1">冲突预约</div>
                  <div className="text-2xl font-bold text-red-700">{conflictingReservations.length}</div>
                </Card>
                {conflictingReservations.length > 0 && (
                  <div className="bg-red-50 border border-red-100 rounded-xl p-3 text-xs text-red-700">
                    <AlertCircle className="w-4 h-4 inline mr-2" />
                    当前显示所有存在时间冲突的预约
                  </div>
                )}
              </div>
            ) : calendarData?.summary && (
              <div className="grid grid-cols-2 gap-3">
                <Card className="rounded-2xl border-gray-200 bg-white shadow-sm p-4 flex flex-col justify-center items-center">
                  <div className="text-xs text-gray-500 font-medium mb-1">总预约</div>
                  <div className="text-2xl font-bold text-gray-900">{calendarData.summary.totalReservations}</div>
                </Card>
                <Card className="rounded-2xl border-green-100 bg-green-50 shadow-sm p-4 flex flex-col justify-center items-center">
                  <div className="text-xs text-green-600 font-medium mb-1">已批准</div>
                  <div className="text-2xl font-bold text-green-700">{calendarData.summary.approved}</div>
                </Card>
                <Card className="rounded-2xl border-amber-100 bg-amber-50 shadow-sm p-4 flex flex-col justify-center items-center col-span-2">
                  <div className="text-xs text-amber-600 font-medium mb-1">待审核</div>
                  <div className="text-2xl font-bold text-amber-700">{calendarData.summary.pending}</div>
                </Card>
              </div>
            )}
          </div>

          <div className="col-span-12 lg:col-span-9 space-y-6">
            <Card className="rounded-2xl border-gray-200 shadow-sm min-h-[600px] flex flex-col">
              <CardHeader className="flex flex-row items-center justify-between py-4 px-6 border-b border-gray-100">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-1 bg-indigo-600 rounded-full" />
                  <CardTitle className="text-lg text-gray-800">
                    {showConflictsOnly ? '冲突预约管理' : hasSelection ? '预约日程' : '请在左侧选择资源'}
                  </CardTitle>
                  {showConflictsOnly && (
                    <Badge variant="destructive" className="ml-2">
                      <AlertCircle className="w-3 h-3 mr-1" />
                      冲突筛选
                    </Badge>
                  )}
                </div>
                {hasSelection && !showConflictsOnly && (
                  <div className="flex items-center gap-2">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                      {(['day', 'week', 'month', 'heatmap'] as const).map((v) => (
                        <button
                          key={v}
                          onClick={() => setViewType(v)}
                          className={`px-2 sm:px-3 py-1 text-xs font-medium rounded-md transition-all touch-manipulation ${
                            viewType === v ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-900 active:bg-gray-200'
                          }`}
                        >
                          {isMobile 
                            ? (v === 'day' ? '日' : v === 'week' ? '周' : v === 'month' ? '月' : '热')
                            : (v === 'day' ? '日视图' : v === 'week' ? '周视图' : v === 'month' ? '月视图' : '热力图')
                          }
                        </button>
                      ))}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-shrink-0 touch-manipulation"
                          title="导出日历数据"
                        >
                          <Download className={`${isMobile ? 'w-4 h-4' : 'w-4 h-4 mr-1.5'}`} />
                          {!isMobile && <span className="text-xs">导出</span>}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleExportCalendar('ics')}>
                          导出为 iCalendar (.ics)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportCalendar('html')}>
                          导出为 HTML (可查看)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExportCalendar('pdf')}>
                          导出为 PDF (可打印)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </CardHeader>
              <CardContent className="p-0 flex-1 relative bg-white rounded-b-2xl overflow-hidden">
                {showConflictsOnly ? (
                  <div className="p-6">
                    {conflictsLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-gray-500">加载冲突数据中...</div>
                      </div>
                    ) : conflictingReservations && conflictingReservations.length > 0 ? (
                      <div className="space-y-3">
                        <div className="text-sm text-gray-600 mb-4 flex items-center gap-2">
                          <AlertCircle className="w-4 h-4 text-red-500" />
                          找到 {conflictingReservations.length} 个有时间冲突的预约
                          <span className="text-xs text-gray-500 ml-2">
                            （按时间+实验室分组显示，点击展开查看详情）
                          </span>
                        </div>
                        {(() => {
                          // 按时间段和实验室分组冲突预约
                          const groupedConflicts = new Map<string, any[]>();
                          conflictingReservations.forEach((conflict: any) => {
                            const key = `${conflict.labId}-${conflict.startTime}-${conflict.endTime}`;
                            if (!groupedConflicts.has(key)) {
                              groupedConflicts.set(key, []);
                            }
                            groupedConflicts.get(key)!.push(conflict);
                          });

                          return Array.from(groupedConflicts.entries())
                            .filter(([_, conflicts]) => conflicts.length > 1) // 只显示真正有冲突的组
                            .map(([key, conflicts]) => (
                            <Card 
                              key={key} 
                              className="rounded-xl border-red-200 hover:shadow-md transition-all bg-red-50/30"
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start justify-between mb-3">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <Badge variant="destructive" className="text-xs">
                                        {conflicts.length} 个预约冲突
                                      </Badge>
                                      <div className="text-sm text-gray-600 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5" />
                                        {format(new Date(conflicts[0].startTime), 'yyyy/MM/dd HH:mm')} - {format(new Date(conflicts[0].endTime), 'HH:mm')}
                                      </div>
                                      <div className="text-sm text-gray-600 flex items-center gap-2">
                                        <MapPin className="w-3.5 h-3.5" />
                                        {conflicts[0].lab?.name} ({conflicts[0].lab?.roomNo})
                                      </div>
                                    </div>
                                  </div>
                                </div>
                                <div className="space-y-2 pl-4 border-l-2 border-red-300">
                                  {conflicts.map((conflict: any, idx: number) => (
                                    <div 
                                      key={conflict.id}
                                      className="flex items-center justify-between p-2 bg-white rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                                      onClick={() => handleEventClick({
                                        id: conflict.id,
                                        title: conflict.title,
                                        startTime: new Date(conflict.startTime),
                                        endTime: new Date(conflict.endTime),
                                        status: conflict.status,
                                        labId: conflict.lab?.id,
                                        labName: conflict.lab?.name,
                                      })}
                                    >
                                      <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs font-mono text-gray-400">#{conflict.id}</span>
                                          <span className="font-medium text-gray-900">{conflict.title}</span>
                                          <Badge variant="outline" className="text-xs">
                                            {conflict.status === 'pending' ? '待审核' : 
                                             conflict.status === 'approved' ? '已批准' : 
                                             conflict.status === 'rejected' ? '已拒绝' : 
                                             conflict.status === 'completed' ? '已完成' : '已取消'}
                                          </Badge>
                                        </div>
                                        <div className="text-xs text-gray-500 mt-1 flex items-center gap-3">
                                          <span className="flex items-center gap-1">
                                            <User className="w-3 h-3" />
                                            {conflict.applicant?.name}
                                          </span>
                                          <span>{conflict.peopleCount} 人</span>
                                        </div>
                                      </div>
                                      <Button size="sm" variant="ghost" className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50">
                                        查看详情
                                      </Button>
                                    </div>
                                  ))}
                                </div>
                              </CardContent>
                            </Card>
                          ));
                        })()}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <CheckCircle className="w-16 h-16 text-green-400 mb-4" />
                        <p className="font-medium text-gray-600">暂无冲突预约</p>
                        <p className="text-sm mt-1">当前时间范围内所有预约均无时间冲突</p>
                      </div>
                    )}
                  </div>
                ) : hasSelection ? (
                  <div className="p-4 h-full">
                    <Calendar
                      events={events}
                      viewType={viewType}
                      onViewChange={setViewType}
                      onDateChange={setCurrentDate}
                      currentDate={currentDate}
                      onEventClick={handleEventClick}
                      loading={calendarLoading || (viewType === 'heatmap' && utilizationLoading)}
                      blockedPeriods={(calendarData as any)?.blockedPeriods?.map((bp: any) => ({
                        ...bp,
                        startDate: new Date(bp.startDate),
                        endDate: new Date(bp.endDate),
                      })) || []}
                      utilizationData={utilizationData || []}
                      isMobile={isMobile}
                    />
                  </div>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50/50">
                    <div className="bg-white p-6 rounded-full shadow-sm mb-4">
                      <LayoutGrid className="w-10 h-10 text-indigo-200" />
                    </div>
                    <p className="font-medium text-gray-900">暂无数据展示</p>
                    <p className="text-sm mt-1">请从左侧选择实验室、设备或课程以查看日程</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 预约详情模态框 */}
            {selectedEvent && (
              <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)} key={selectedEvent.id}>
                <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto rounded-2xl">
                {selectedEvent && (
                  <>
                    <DialogHeader className="pb-4 border-b border-gray-100">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={`
                              ${selectedEvent.status === 'approved' ? 'bg-green-100 text-green-700 hover:bg-green-100' : 
                                selectedEvent.status === 'pending' ? 'bg-amber-100 text-amber-700 hover:bg-amber-100' :
                                selectedEvent.status === 'rejected' ? 'bg-red-100 text-red-700 hover:bg-red-100' :
                                selectedEvent.status === 'completed' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100' :
                                'bg-gray-100 text-gray-700 hover:bg-gray-100'}
                            `}>
                              {selectedEvent.status === 'approved' ? '已批准' : 
                                selectedEvent.status === 'pending' ? '待审核' :
                                selectedEvent.status === 'rejected' ? '已拒绝' :
                                selectedEvent.status === 'completed' ? '已完成' : '已取消'}
                            </Badge>
                            {/* 冲突徽章 - 基于前端和后端检测 */}
                            {(conflictDetails && conflictDetails.length > 0) || checkEventConflict(selectedEvent) ? (
                              <Badge variant="destructive" className="flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                冲突
                              </Badge>
                            ) : null}
                          </div>
                          <DialogTitle className="text-xl font-bold text-gray-900 pr-4">{selectedEvent.title}</DialogTitle>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="pt-4 space-y-4">
                      {/* 冲突警告 - 基于前端和后端检测 */}
                      {((conflictDetails && conflictDetails.length > 0) || checkEventConflict(selectedEvent)) && (
                        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
                          <div className="flex items-start gap-3 mb-3">
                            <div className="p-2 bg-white rounded-full text-red-600 shadow-sm flex-shrink-0">
                              <TrendingUp className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-red-800 mb-1">检测到时间冲突</p>
                              <p className="text-xs text-red-600">
                                {conflictDetails && conflictDetails.length > 0 
                                  ? `此预约与 ${conflictDetails.length} 个其他预约存在时间重叠`
                                  : '此时段已有其他安排，建议调整'}
                              </p>
                            </div>
                          </div>
                          <Button 
                            size="sm" 
                            onClick={handleConflictCheck} 
                            variant="outline" 
                            className="w-full sm:w-auto bg-white border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                          >
                            查看建议方案
                          </Button>
                        </div>
                      )}
                      
                      {/* 显示冲突详情列表与替代建议（集成在预约详情内）*/}
                      {((conflictDetails && conflictDetails.length > 0) || alternativeSlots.length > 0) && (
                        <div className="border-t border-gray-100 pt-4 mt-4 space-y-4">
                          {/* 冲突的预约列表 */}
                          {conflictDetails && conflictDetails.length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-semibold text-red-800">冲突的预约（{conflictDetails.length}个）：</p>
                              <div className="max-h-48 overflow-y-auto space-y-2">
                                {conflictDetails.map((conflict: any) => (
                                  <div key={conflict.id} className="bg-white rounded-lg p-2 text-xs border border-red-200">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-gray-900">{conflict.title}</span>
                                      <Badge variant="outline" className="text-xs">{conflict.status === 'approved' ? '已批准' : '待审核'}</Badge>
                                    </div>
                                    <div className="text-gray-600 mt-1">
                                      {format(new Date(conflict.startTime), 'MM-dd HH:mm')} - {format(new Date(conflict.endTime), 'HH:mm')}
                                    </div>
                                    {conflict.applicant && (
                                      <div className="text-gray-500 mt-1">申请人: {conflict.applicant.name}</div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* 替代建议列表 */}
                          {alternativeSlots.length > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-semibold text-indigo-700">智能调度建议</p>
                                {suggestionsLoading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-600" />}
                              </div>
                              <div className="max-h-48 overflow-y-auto space-y-2">
                                {alternativeSlots.map((slot, idx) => (
                                  <div key={idx} className="flex items-center justify-between p-3 bg-indigo-50 border border-indigo-100 rounded-lg text-xs">
                                    <div>
                                      <div className="font-medium text-indigo-900">
                                        {format(new Date(slot.startTime), 'MM/dd HH:mm')} - {format(new Date(slot.endTime), 'HH:mm')}
                                      </div>
                                      <Badge className="bg-indigo-100 text-indigo-700 hover:bg-indigo-100 text-xs mt-1">
                                        匹配度 {Math.round(slot.confidence * 100)}%
                                      </Badge>
                                    </div>
                                    <Button size="sm" onClick={() => handleApplyAlternativeSlot(slot, false)} className="bg-indigo-600 hover:bg-indigo-700 text-xs">
                                      采用
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {reservationDetails ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <User className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-500 font-medium">申请人</p>
                              <p className="font-semibold text-gray-900 mt-0.5 truncate">
                                {reservationDetails.applicant?.name || '加载中...'}
                              </p>
                              <p className="text-xs text-gray-400 truncate">{reservationDetails.applicant?.email}</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <Clock className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-500 font-medium">时间段</p>
                              <p className="font-semibold text-gray-900 mt-0.5">
                                {format(new Date(selectedEvent.startTime), 'MM月dd日 HH:mm')} - {format(new Date(selectedEvent.endTime), 'HH:mm')}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                            <MapPin className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-gray-500 font-medium">地点</p>
                              <p className="font-semibold text-gray-900 mt-0.5 truncate">{reservationDetails.lab?.name || '...'}</p>
                            </div>
                          </div>
                          {reservationDetails.course && (
                            <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                              <BookOpen className="w-5 h-5 text-gray-400 mt-0.5 flex-shrink-0" />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs text-gray-500 font-medium">关联课程</p>
                                <p className="font-semibold text-gray-900 mt-0.5 truncate">{(reservationDetails.course as any).name}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-center py-8">
                          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mb-2"></div>
                          <p className="text-gray-500 text-sm">加载详情中...</p>
                        </div>
                      )}

                      {/* 管理操作 */}
                      <div className="border-t border-gray-100 pt-4 space-y-2">
                        <p className="text-xs font-semibold text-gray-500 uppercase mb-2">管理操作</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <a href={`/admin/audit-logs?targetId=${selectedEvent.id}`} className="w-full">
                            <Button variant="outline" size="sm" className="w-full justify-start text-gray-600">
                              <FileText className="w-4 h-4 mr-2" /> 查看审计日志
                            </Button>
                          </a>

                          {(user?.role === 'sysAdmin' || user?.role === 'labAdmin') && selectedEvent.status === 'pending' && (
                            <>
                              <Button 
                                onClick={handleApprove} 
                                variant="default" 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 w-full justify-start"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" /> 批准
                              </Button>
                              <Button 
                                onClick={handleReject} 
                                variant="destructive" 
                                size="sm" 
                                className="w-full justify-start"
                              >
                                <XCircle className="w-4 h-4 mr-2" /> 拒绝
                              </Button>
                            </>
                          )}

                          {(user?.role === 'student' || user?.role === 'teacher') && 
                           selectedEvent.status === 'pending' && 
                           reservationDetails?.userId === user?.id && (
                            <Button 
                              onClick={handleCancel} 
                              variant="outline" 
                              size="sm" 
                              className="w-full justify-start"
                            >
                              取消预约
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </DialogContent>
            </Dialog>
            )}
          </div>
        </div>
      </div>

</div>
  );
}
