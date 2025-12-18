import React, { useState, useMemo } from 'react';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, MapPin } from 'lucide-react';
import { format, addDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, endOfWeek, isSameMonth, isSameDay } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface CalendarEvent {
  id: number;
  title: string;
  startTime: Date;
  endTime: Date;
  status: 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
  labName?: string;
  courseId?: number;
}

interface BlockedPeriod {
  id: number;
  labId: number | null;
  deviceId: number | null;
  reason: string;
  startDate: Date;
  endDate: Date;
  handleExisting: 'allow' | 'warn' | 'cancel';
  status: 'active' | 'inactive';
}

interface UtilizationData {
  date: string;
  count: number;
  hours: number;
}

interface CalendarProps {
  events: CalendarEvent[];
  viewType: 'day' | 'week' | 'month' | 'heatmap';
  onViewChange: (view: 'day' | 'week' | 'month' | 'heatmap') => void;
  onDateChange: (date: Date) => void;
  currentDate: Date;
  onEventClick?: (event: CalendarEvent) => void;
  loading?: boolean;
  blockedPeriods?: BlockedPeriod[];
  utilizationData?: UtilizationData[];
  isMobile?: boolean;
}

export function Calendar({
  events = [],
  viewType = 'month',
  onViewChange,
  onDateChange,
  currentDate,
  onEventClick,
  loading = false,
  blockedPeriods = [],
  utilizationData = [],
  isMobile = false,
}: CalendarProps) {
  const [selectedDate, setSelectedDate] = useState(currentDate);

  // 去重事件（基于 ID）
  const uniqueEvents = useMemo(() => {
    const seen = new Set<number>();
    return events.filter(event => {
      if (seen.has(event.id)) {
        return false;
      }
      seen.add(event.id);
      return true;
    });
  }, [events]);

  const handleDateClick = (date: Date) => {
    setSelectedDate(date);
    onDateChange(date);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'rejected':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: '待审核',
      approved: '已批准',
      rejected: '已拒绝',
      completed: '已完成',
      cancelled: '已取消',
    };
    return labels[status] || status;
  };

  // 检测时间冲突
  const checkConflict = (event: CalendarEvent): boolean => {
    return uniqueEvents.some(otherEvent => {
      if (otherEvent.id === event.id) return false;
      // 只检查已批准状态的预约
      if (otherEvent.status !== 'approved' && otherEvent.status !== 'pending') return false;
      
      // 检查时间重叠: NOT (end1 <= start2 OR start1 >= end2)
      const overlap = !(event.endTime <= otherEvent.startTime || event.startTime >= otherEvent.endTime);
      return overlap;
    });
  };

  if (viewType === 'heatmap') {
    return <HeatmapView
      selectedDate={selectedDate}
      onDateClick={handleDateClick}
      currentDate={currentDate}
      onViewChange={onViewChange}
      loading={loading}
      utilizationData={utilizationData}
      isMobile={isMobile}
    />;
  }

  if (viewType === 'month') {
    return <MonthView 
      selectedDate={selectedDate}
      onDateClick={handleDateClick}
      events={uniqueEvents}
      getStatusColor={getStatusColor}
      getStatusLabel={getStatusLabel}
      checkConflict={checkConflict}
      onEventClick={onEventClick}
      onViewChange={onViewChange}
      currentDate={currentDate}
      loading={loading}
      blockedPeriods={blockedPeriods}
      isMobile={isMobile}
    />;
  }

  if (viewType === 'week') {
    return <WeekView
      selectedDate={selectedDate}
      onDateClick={handleDateClick}
      events={uniqueEvents}
      getStatusColor={getStatusColor}
      getStatusLabel={getStatusLabel}
      checkConflict={checkConflict}
      onEventClick={onEventClick}
      onViewChange={onViewChange}
      currentDate={currentDate}
      loading={loading}
      blockedPeriods={blockedPeriods}
      isMobile={isMobile}
    />;
  }

  return <DayView
    selectedDate={selectedDate}
    onDateClick={handleDateClick}
    events={uniqueEvents}
    getStatusColor={getStatusColor}
    getStatusLabel={getStatusLabel}
    checkConflict={checkConflict}
    onEventClick={onEventClick}
    onViewChange={onViewChange}
    currentDate={currentDate}
    loading={loading}
    blockedPeriods={blockedPeriods}
    isMobile={isMobile}
  />;
}

interface ViewProps {
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  events: CalendarEvent[];
  getStatusColor: (status: string) => string;
  getStatusLabel: (status: string) => string;
  checkConflict: (event: CalendarEvent) => boolean;
  onEventClick?: (event: CalendarEvent) => void;
  onViewChange: (view: 'day' | 'week' | 'month' | 'heatmap') => void;
  currentDate: Date;
  loading?: boolean;
  blockedPeriods?: BlockedPeriod[];
  isMobile?: boolean;
}

function MonthView({
  selectedDate,
  onDateClick,
  events,
  getStatusColor,
  getStatusLabel,
  checkConflict,
  onEventClick,
  onViewChange,
  currentDate,
  loading,
  blockedPeriods = [],
  isMobile = false,
}: ViewProps) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDate = (date: Date) => {
    return events.filter(e => isSameDay(new Date(e.startTime), date));
  };

  // 检查日期是否有禁用时段
  const isDateBlocked = (date: Date): boolean => {
    return blockedPeriods.some(period => {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      return date >= periodStart && date <= periodEnd;
    });
  };

  const nextMonth = () => onDateClick(addDays(selectedDate, 32));
  const prevMonth = () => onDateClick(addDays(selectedDate, -32));

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-2 sm:p-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between mb-3 sm:mb-6 flex-wrap gap-2">
        <div className="flex gap-1 sm:gap-2 order-2 sm:order-1">
          <button
            onClick={() => onViewChange('day')}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded hover:bg-gray-50 touch-manipulation active:bg-gray-100"
          >
            {isMobile ? '日' : '日视图'}
          </button>
          <button
            onClick={() => onViewChange('week')}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded hover:bg-gray-50 touch-manipulation active:bg-gray-100"
          >
            {isMobile ? '周' : '周视图'}
          </button>
          <button
            onClick={() => onViewChange('month')}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded bg-blue-50 touch-manipulation active:bg-blue-100"
          >
            {isMobile ? '月' : '月视图'}
          </button>
          <button
            onClick={() => onViewChange('heatmap')}
            className="px-2 sm:px-3 py-1 text-xs sm:text-sm border rounded hover:bg-gray-50 touch-manipulation active:bg-gray-100"
          >
            {isMobile ? '热' : '热力图'}
          </button>
        </div>

        <h2 className="text-sm sm:text-lg font-semibold order-1 sm:order-2 flex-1 text-center sm:text-left">
          {format(selectedDate, isMobile ? 'MMM yyyy' : 'MMMM yyyy', { locale: zhCN })}
        </h2>

        <div className="flex gap-1 sm:gap-2 order-3">
          <button
            onClick={prevMonth}
            className="p-1.5 sm:p-1 hover:bg-gray-100 rounded touch-manipulation active:bg-gray-200"
          >
            <ChevronLeft size={isMobile ? 18 : 20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1.5 sm:p-1 hover:bg-gray-100 rounded touch-manipulation active:bg-gray-200"
          >
            <ChevronRight size={isMobile ? 18 : 20} />
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-gray-500 text-sm">加载中...</div>}

      {/* 日期网格 */}
      {!loading && (
        <>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 mb-1 sm:mb-2">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
              <div key={day} className={`text-center ${isMobile ? 'text-xs' : 'text-sm'} font-semibold text-gray-600 py-1 sm:py-2`}>
                {isMobile ? day.replace('周', '') : day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {days.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              const isCurrentMonth = isSameMonth(day, selectedDate);

              return (
                <div
                  key={idx}
                  onClick={() => onDateClick(day)}
                  className={`${isMobile ? 'min-h-16' : 'min-h-24'} p-1 sm:p-2 border rounded cursor-pointer transition relative touch-manipulation active:scale-95 ${
                    isCurrentMonth ? 'bg-white' : 'bg-gray-50'
                  } ${
                    isSameDay(day, selectedDate) ? 'border-blue-500 border-2' : 'border-gray-200'
                  } hover:bg-blue-50 ${isDateBlocked(day) ? 'bg-gray-200 opacity-60' : ''}`}
                >
                  {isDateBlocked(day) && (
                    <div className="absolute inset-0 bg-gray-400 opacity-30 rounded pointer-events-none" title="维护期/禁用时段" />
                  )}
                  <div className={`${isMobile ? 'text-xs' : 'text-sm'} font-semibold mb-0.5 sm:mb-1 relative z-10 ${isDateBlocked(day) ? 'text-gray-500' : ''}`}>
                    {format(day, 'd')}
                  </div>
                  {!isMobile && (
                    <div className="space-y-1">
                      {dayEvents.slice(0, 2).map(event => {
                        const hasConflict = checkConflict(event);
                        return (
                          <div
                            key={event.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onEventClick?.(event);
                            }}
                            className={`text-xs p-1 rounded border cursor-pointer hover:shadow-md touch-manipulation ${getStatusColor(
                              event.status
                            )} ${hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                            title={hasConflict ? '存在时间冲突' : ''}
                          >
                            <div className="flex items-center gap-1">
                              {hasConflict && <AlertTriangle className="h-3.5 w-3.5 text-red-600" />}
                              <div className="truncate font-medium flex-1">{event.title}</div>
                            </div>
                            <div className="text-xs opacity-75">
                              {format(new Date(event.startTime), 'HH:mm')}
                            </div>
                          </div>
                        );
                      })}
                      {dayEvents.length > 2 && (
                        <div className="text-xs text-gray-500 px-1">
                          +{dayEvents.length - 2} 更多
                        </div>
                      )}
                    </div>
                  )}
                  {isMobile && dayEvents.length > 0 && (
                    <div className="text-[10px] text-gray-500 mt-0.5">
                      {dayEvents.length}项
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function WeekView({
  selectedDate,
  onDateClick,
  events,
  getStatusColor,
  getStatusLabel,
  checkConflict,
  onEventClick,
  onViewChange,
  currentDate,
  loading,
  blockedPeriods = [],
  isMobile = false,
}: ViewProps) {
  const weekStart = startOfWeek(selectedDate);
  const weekDays = eachDayOfInterval({ start: weekStart, end: addDays(weekStart, 6) });

  const getEventsForDate = (date: Date) => {
    return events.filter(e => isSameDay(new Date(e.startTime), date));
  };

  // 检查日期是否有禁用时段
  const isDateBlocked = (date: Date): boolean => {
    return blockedPeriods.some(period => {
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);
      return date >= periodStart && date <= periodEnd;
    });
  };

  const nextWeek = () => onDateClick(addDays(selectedDate, 7));
  const prevWeek = () => onDateClick(addDays(selectedDate, -7));

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('day')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            日
          </button>
          <button
            onClick={() => onViewChange('week')}
            className="px-3 py-1 text-sm border rounded bg-blue-50"
          >
            周
          </button>
          <button
            onClick={() => onViewChange('month')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            月
          </button>
          <button
            onClick={() => onViewChange('heatmap')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            热力图
          </button>
        </div>

        <h2 className="text-lg font-semibold">
          {format(weekStart, 'yyyy年MM月dd日', { locale: zhCN })} -{' '}
          {format(addDays(weekStart, 6), 'MM月dd日', { locale: zhCN })}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={prevWeek}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextWeek}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-gray-500">加载中...</div>}

      {!loading && (
        <div className="overflow-x-auto">
          <div className="grid grid-cols-7 gap-1 min-w-full">
            {weekDays.map((day, idx) => {
              const dayEvents = getEventsForDate(day);
              const isDayBlocked = isDateBlocked(day);

              return (
                <div
                  key={idx}
                  onClick={() => onDateClick(day)}
                  className={`border rounded p-2 cursor-pointer transition relative ${
                    isSameDay(day, selectedDate)
                      ? 'border-blue-500 border-2 bg-blue-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  } ${isDayBlocked ? 'bg-gray-200 opacity-60' : ''}`}
                >
                  {isDayBlocked && (
                    <div className="absolute inset-0 bg-gray-400 opacity-30 rounded pointer-events-none" title="维护期/禁用时段" />
                  )}
                  <div className={`text-center mb-2 relative z-10 ${isDayBlocked ? 'text-gray-500' : ''}`}>
                    <div className="font-semibold">
                      {format(day, 'EEE', { locale: zhCN })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {format(day, 'd日')}
                    </div>
                  </div>

                  <div className={`space-y-1 min-h-32 relative ${isDateBlocked(day) ? 'opacity-60' : ''}`}>
                    {dayEvents.map(event => {
                      const hasConflict = checkConflict(event);
                      return (
                        <div
                          key={event.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick?.(event);
                          }}
                          className={`p-1 rounded border text-xs cursor-pointer hover:shadow-md ${getStatusColor(
                            event.status
                          )} ${hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                          title={hasConflict ? '存在时间冲突' : ''}
                        >
                          <div className="flex items-center gap-1">
                            {hasConflict && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            <div className="truncate font-medium flex-1">{event.title}</div>
                          </div>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <Clock size={10} />
                            {format(new Date(event.startTime), 'HH:mm')} -
                            {format(new Date(event.endTime), 'HH:mm')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function DayView({
  selectedDate,
  onDateClick,
  events,
  getStatusColor,
  getStatusLabel,
  checkConflict,
  onEventClick,
  onViewChange,
  currentDate,
  loading,
  blockedPeriods = [],
  isMobile = false,
}: ViewProps) {
  const dayEvents = events.filter(e => isSameDay(new Date(e.startTime), selectedDate));

  const nextDay = () => onDateClick(addDays(selectedDate, 1));
  const prevDay = () => onDateClick(addDays(selectedDate, -1));

  // 生成时间轴（08:00 - 20:00）
  const hours = Array.from({ length: 13 }, (_, i) => 8 + i);

  // 检查日期是否有禁用时段
  const isTodayBlocked = blockedPeriods.some(period => {
    const periodStart = new Date(period.startDate);
    const periodEnd = new Date(period.endDate);
    return selectedDate >= periodStart && selectedDate <= periodEnd;
  });

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('day')}
            className="px-3 py-1 text-sm border rounded bg-blue-50"
          >
            日
          </button>
          <button
            onClick={() => onViewChange('week')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            周
          </button>
          <button
            onClick={() => onViewChange('month')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            月
          </button>
          <button
            onClick={() => onViewChange('heatmap')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            热力图
          </button>
        </div>

        <h2 className="text-lg font-semibold">
          {format(selectedDate, 'yyyy年MM月dd日 EEEE', { locale: zhCN })}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={prevDay}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextDay}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-gray-500">加载中...</div>}

      {isTodayBlocked && !loading && (
        <div className="mb-4 p-3 bg-gray-200 border border-gray-300 rounded-lg">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-semibold flex items-center gap-1">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              维护期/禁用时段
            </span>
            <span className="text-xs">
              {blockedPeriods
                .filter(bp => {
                  const bpStart = new Date(bp.startDate);
                  const bpEnd = new Date(bp.endDate);
                  return selectedDate >= bpStart && selectedDate <= bpEnd;
                })
                .map(bp => bp.reason)
                .join(', ')}
            </span>
          </div>
        </div>
      )}

      {!loading && (
        <div className="overflow-y-auto max-h-96">
          <div className="space-y-2">
            {hours.map(hour => {
              const hourEvents = dayEvents.filter(e => {
                const eventHour = new Date(e.startTime).getHours();
                return eventHour === hour;
              });
              
              // 检查该小时是否在禁用时段内
              const isHourBlocked = blockedPeriods.some(bp => {
                const bpStart = new Date(bp.startDate);
                const bpEnd = new Date(bp.endDate);
                const hourStart = new Date(selectedDate);
                hourStart.setHours(hour, 0, 0, 0);
                const hourEnd = new Date(selectedDate);
                hourEnd.setHours(hour + 1, 0, 0, 0);
                // 检查时间重叠
                return !(hourEnd <= bpStart || hourStart >= bpEnd);
              });

              return (
                <div key={hour} className={`flex border-t relative ${isHourBlocked ? 'bg-gray-200 opacity-50' : ''}`}>
                  {isHourBlocked && (
                    <div className="absolute inset-0 bg-gray-400 opacity-20 pointer-events-none" title="维护期/禁用时段" />
                  )}
                  <div className={`w-16 text-right text-xs pr-2 py-2 flex-shrink-0 relative z-10 ${isHourBlocked ? 'text-gray-400' : 'text-gray-500'}`}>
                    {String(hour).padStart(2, '0')}:00
                  </div>
                  <div className="flex-1 py-2 space-y-1 relative z-10">
                    {hourEvents.map(event => {
                      const hasConflict = checkConflict(event);
                      return (
                        <div
                          key={event.id}
                          onClick={() => onEventClick?.(event)}
                          className={`p-2 rounded border text-xs cursor-pointer hover:shadow-md ${getStatusColor(
                            event.status
                          )} ${hasConflict ? 'ring-2 ring-red-500 ring-offset-1' : ''}`}
                          title={hasConflict ? '存在时间冲突' : ''}
                        >
                          <div className="flex items-center gap-1">
                            {hasConflict && <AlertTriangle className="h-4 w-4 text-red-600" />}
                            <div className="font-medium flex-1">{event.title}</div>
                          </div>
                          <div className="flex items-center gap-1 text-xs opacity-75">
                            <MapPin size={12} />
                            {event.labName}
                          </div>
                          <div className="text-xs opacity-75">
                            {format(new Date(event.startTime), 'HH:mm')} -{' '}
                            {format(new Date(event.endTime), 'HH:mm')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function HeatmapView({
  selectedDate,
  onDateClick,
  currentDate,
  onViewChange,
  loading,
  utilizationData = [],
  isMobile = false,
}: {
  selectedDate: Date;
  onDateClick: (date: Date) => void;
  currentDate: Date;
  onViewChange: (view: 'day' | 'week' | 'month' | 'heatmap') => void;
  loading?: boolean;
  utilizationData: UtilizationData[];
  isMobile?: boolean;
}) {
  const monthStart = startOfMonth(selectedDate);
  const monthEnd = endOfMonth(selectedDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // 创建利用率映射表
  const utilizationMap = new Map<string, UtilizationData>();
  utilizationData.forEach(item => {
    utilizationMap.set(item.date, item);
  });

  // 计算最大预约数和最大小时数（用于归一化）
  const maxCount = Math.max(...utilizationData.map(d => d.count), 1);
  const maxHours = Math.max(...utilizationData.map(d => d.hours), 1);

  // 获取利用率颜色（基于预约数量）
  const getUtilizationColor = (count: number, max: number): string => {
    if (count === 0) return 'bg-gray-100';
    const intensity = Math.min(count / max, 1);
    if (intensity < 0.2) return 'bg-green-100';
    if (intensity < 0.4) return 'bg-green-300';
    if (intensity < 0.6) return 'bg-yellow-300';
    if (intensity < 0.8) return 'bg-orange-400';
    return 'bg-red-500';
  };

  // 获取利用率文本颜色
  const getTextColor = (count: number): string => {
    if (count === 0) return 'text-gray-400';
    return 'text-gray-900 font-semibold';
  };

  const nextMonth = () => onDateClick(addDays(selectedDate, 32));
  const prevMonth = () => onDateClick(addDays(selectedDate, -32));

  return (
    <div className="w-full bg-white rounded-lg shadow-md p-4">
      {/* 头部控制 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex gap-2">
          <button
            onClick={() => onViewChange('day')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            日
          </button>
          <button
            onClick={() => onViewChange('week')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            周
          </button>
          <button
            onClick={() => onViewChange('month')}
            className="px-3 py-1 text-sm border rounded hover:bg-gray-50"
          >
            月
          </button>
          <button
            onClick={() => onViewChange('heatmap')}
            className="px-3 py-1 text-sm border rounded bg-blue-50"
          >
            热力图
          </button>
        </div>

        <h2 className="text-lg font-semibold">
          {format(selectedDate, 'MMMM yyyy', { locale: zhCN })}
        </h2>

        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            onClick={nextMonth}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {loading && <div className="text-center py-4 text-gray-500">加载中...</div>}

      {!loading && (
        <>
          {/* 图例 */}
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>利用率：</span>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-gray-100 rounded"></div>
                <span className="text-xs">无</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-green-100 rounded"></div>
                <span className="text-xs">低</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-yellow-300 rounded"></div>
                <span className="text-xs">中</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-orange-400 rounded"></div>
                <span className="text-xs">高</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-xs">极高</span>
              </div>
            </div>
            <div className="text-xs text-gray-500">
              最大预约数: {maxCount} | 最大小时数: {maxHours}h
            </div>
          </div>

          {/* 日期网格 */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['周一', '周二', '周三', '周四', '周五', '周六', '周日'].map(day => (
              <div key={day} className="text-center text-sm font-semibold text-gray-600 py-2">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isCurrentMonth = isSameMonth(day, selectedDate);
              const dateStr = format(day, 'yyyy-MM-dd');
              const utilization = utilizationMap.get(dateStr);
              const count = utilization?.count || 0;
              const hours = utilization?.hours || 0;

              const utilizationColor = getUtilizationColor(count, maxCount);
              const baseBgColor = count === 0 ? (isCurrentMonth ? 'bg-white' : 'bg-gray-50') : '';
              
              return (
                <div
                  key={idx}
                  onClick={() => onDateClick(day)}
                  className={`min-h-20 p-2 border rounded cursor-pointer transition relative ${
                    isSameDay(day, selectedDate) ? 'border-blue-500 border-2' : 'border-gray-200'
                  } hover:shadow-md ${utilizationColor} ${baseBgColor}`}
                  title={`${format(day, 'yyyy-MM-dd')}: ${count} 个预约, ${hours} 小时`}
                >
                  <div className={`text-sm font-semibold mb-1 ${getTextColor(count)}`}>
                    {format(day, 'd')}
                  </div>
                  {utilization && (
                    <div className="text-xs space-y-0.5">
                      <div className={`${getTextColor(count)}`}>
                        {count} 预约
                      </div>
                      <div className={`${getTextColor(count)} opacity-75`}>
                        {hours}h
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
