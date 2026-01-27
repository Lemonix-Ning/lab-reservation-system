1.用户端

1.1 路由入口（前端代码）
File: client/src/App.tsx (L1-80)
`tsx
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import DashboardLayout from "./components/DashboardLayout";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import LabRoomList from "./pages/LabRoomList";
import LabRoomManage from "./pages/LabRoomManage";
import DeviceManage from "./pages/DeviceManage";
import MyReservations from "./pages/MyReservations";
import ReservationManage from "./pages/ReservationManage";
import RuleManage from "./pages/RuleManage";
import StatisticsDashboard from "./pages/StatisticsDashboard";
import NotificationCenter from "./pages/NotificationCenter";
import ApprovalConfig from "./pages/ApprovalConfig";
import ViolationManage from "./pages/ViolationManage";
import AuditLog from "./pages/AuditLog";
import CourseManage from "./pages/CourseManage";
import StudentCourses from "./pages/StudentCourses";
import CalendarDashboard from "./pages/CalendarDashboard";
import BlockedPeriodManage from "./pages/BlockedPeriodManage";
import OpeningRuleManage from "./pages/OpeningRuleManage";

function Router() {
  return (
    <Switch>
      <Route path={"/"} component={Home} />
      <Route path={"/labs"} component={LabRoomList} />
      <Route path={"/my-reservations"} component={MyReservations} />
      <Route path={"/notifications"} component={NotificationCenter} />
      <Route path={"/courses"} component={CourseManage} />
      <Route path={"/student/courses"} component={StudentCourses} />
      <Route path={"/calendar"} component={CalendarDashboard} />
      <Route path={"/admin/labs"} component={LabRoomManage} />
      <Route path={"/admin/devices"} component={DeviceManage} />
      <Route path={"/admin/reservations"} component={ReservationManage} />
      <Route path={"/admin/rules"} component={RuleManage} />
      <Route path={"/admin/statistics"} component={StatisticsDashboard} />
      <Route path={"/admin/approval-config"} component={ApprovalConfig} />
      <Route path={"/admin/violations"} component={ViolationManage} />
      <Route path={"/admin/audit-logs"} component={AuditLog} />
      <Route path={"/admin/opening-rules"} component={OpeningRuleManage} />
      <Route path={"/admin/blocked-periods"} component={BlockedPeriodManage} />
      <Route path={"/404"} component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <DashboardLayout>
            <Router />
          </DashboardLayout>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
`

1.2 实验室列表与创建预约（前端代码）
File: client/src/pages/LabRoomList.tsx (L1-210)
`tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { useReservationRules } from "@/hooks/useReservationRules";
import { FlaskConical, MapPin, Users, AlertCircle, CheckCircle, Clock } from "lucide-react";
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

function parseLocalDateTimeInput(dateTimeStr: string): Date | null {
  if (!dateTimeStr) return null;
  
  const [datePart, timePart] = dateTimeStr.split("T");
  if (!datePart || !timePart) return null;
  
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return null;
  }
  
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return date;
}

function getCurrentDateTimeLocal(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export default function LabRoomList() {
  const { user, isAuthenticated } = useAuth();
  const [selectedLab, setSelectedLab] = useState<number | null>(null);
  const [reservationForm, setReservationForm] = useState({
    title: "",
    reason: "",
    peopleCount: 1,
    startTime: "",
    endTime: "",
  });
  const [basicValidationError, setBasicValidationError] = useState<string | null>(null);

  const { checkReservation, errorMessage, isChecking, formatRuleDescription, conflictingReservations } = useReservationRules();

  const { data: labs, isLoading } = trpc.labRoom.list.useQuery();
  const utils = trpc.useUtils();
  const createReservation = trpc.reservation.create.useMutation({
    onSuccess: () => {
      toast.success("预约申请已提交，等待审核");
      setSelectedLab(null);
      setReservationForm({ title: "", reason: "", peopleCount: 1, startTime: "", endTime: "" });
      setBasicValidationError(null);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const validateTimes = useCallback((startTimeStr: string, endTimeStr: string): { valid: boolean; error: string | null } => {
    if (!startTimeStr || !endTimeStr) {
      return { valid: false, error: null };
    }

    const startDate = parseLocalDateTimeInput(startTimeStr);
    const endDate = parseLocalDateTimeInput(endTimeStr);

    if (!startDate || !endDate) {
      return { valid: false, error: "时间格式无效，请检查输入" };
    }

    if (startDate >= endDate) {
      return { valid: false, error: "结束时间必须晚于开始时间" };
    }

    return { valid: true, error: null };
  }, []);

  useEffect(() => {
    if (!selectedLab) {
      setBasicValidationError(null);
      return;
    }

    const timeValidation = validateTimes(reservationForm.startTime, reservationForm.endTime);
    setBasicValidationError(timeValidation.error);

    if (!timeValidation.valid) {
      return;
    }

    const startDate = parseLocalDateTimeInput(reservationForm.startTime)!;
    const endDate = parseLocalDateTimeInput(reservationForm.endTime)!;
    checkReservation(selectedLab, startDate, endDate);
  }, [selectedLab, reservationForm.startTime, reservationForm.endTime, checkReservation, validateTimes]);

  const handleSubmitReservation = () => {
    if (!selectedLab) return;
    
    const timeValidation = validateTimes(reservationForm.startTime, reservationForm.endTime);
    if (!timeValidation.valid) {
      toast.error(timeValidation.error || "请输入有效的时间");
      return;
    }
    
    if (errorMessage) {
      toast.error(errorMessage);
      return;
    }
    
    const startDate = parseLocalDateTimeInput(reservationForm.startTime)!;
    const endDate = parseLocalDateTimeInput(reservationForm.endTime)!;
    
    createReservation.mutate({
      labId: selectedLab,
      title: reservationForm.title,
      reason: reservationForm.reason,
      peopleCount: reservationForm.peopleCount,
      startTime: startDate,
      endTime: endDate,
    });
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>需要登录</CardTitle>
            <CardDescription>请先登录后再浏览实验室</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>登录</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">实验室列表</h2>
          <p className="text-gray-600">选择实验室并提交预约申请</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {labs?.filter(lab => lab.status === 'enabled').map((lab) => (
              <Card key={lab.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FlaskConical className="h-5 w-5 text-blue-600" />
                    {lab.name}
                  </CardTitle>
                  <CardDescription>{lab.roomNo}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4" />
                    <span>{lab.building} - {lab.location}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Users className="h-4 w-4" />
                    <span>容纳人数: {lab.capacity}</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    类型: {lab.type}
                  </div>
                  <div className="text-sm text-gray-600">
                    开放时间: {lab.openTimeStart} - {lab.openTimeEnd}
                  </div>
                  {lab.remark && (
                    <div className="text-sm text-gray-500 mt-2">{lab.remark}</div>
`

1.3 我的预约（前端代码）
File: client/src/pages/MyReservations.tsx (L1-134)
`tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";
import { toast } from "sonner";
import { Link } from "wouter";

const statusMap = {
  pending: { label: "待审核", color: "text-yellow-600" },
  approved: { label: "已通过", color: "text-green-600" },
  rejected: { label: "已拒绝", color: "text-red-600" },
  cancelled: { label: "已取消", color: "text-gray-600" },
  completed: { label: "已完成", color: "text-blue-600" },
  violated: { label: "已违约", color: "text-red-900" },
};

export default function MyReservations() {
  const { user, isAuthenticated } = useAuth();
  const { data: reservations, isLoading } = trpc.reservation.myList.useQuery();
  const utils = trpc.useUtils();
  
  const cancelReservation = trpc.reservation.cancel.useMutation({
    onSuccess: () => {
      toast.success("预约已取消");
      utils.reservation.myList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle>需要登录</CardTitle>
            <CardDescription>请先登录后再查看预约记录</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <a href={getLoginUrl()}>登录</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="bg-gray-50">
      
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">我的预约</h2>
          <p className="text-gray-600">查看和管理您的所有预约记录</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : reservations && reservations.length > 0 ? (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>实验室</TableHead>
                    <TableHead>预约标题</TableHead>
                    <TableHead>开始时间</TableHead>
                    <TableHead>结束时间</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell>{reservation.labRoom?.name || '未知'}</TableCell>
                      <TableCell>{reservation.title}</TableCell>
                      <TableCell>
                        {format(new Date(reservation.startTime), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        {format(new Date(reservation.endTime), "yyyy-MM-dd HH:mm")}
                      </TableCell>
                      <TableCell>
                        <span className={statusMap[reservation.status].color}>
                          {statusMap[reservation.status].label}
                        </span>
                        {reservation.status === 'rejected' && reservation.rejectReason && (
                          <div className="text-xs text-gray-500 mt-1">
                            原因: {reservation.rejectReason}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {reservation.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => cancelReservation.mutate({ id: reservation.id })}
                            disabled={cancelReservation.isPending}
                          >
                            取消
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-12 text-center text-gray-500">
              暂无预约记录
              <div className="mt-4">
                <Link href="/labs">
                  <Button>去预约</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
`

1.4 日历调度（前端代码）
File: client/src/pages/CalendarDashboard.tsx (L72-291)
`tsx
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
    staleTime: 1000 * 60 * 60,
    gcTime: 1000 * 60 * 60 * 2
  });
  const { data: devicesData } = trpc.device.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 60, 
    gcTime: 1000 * 60 * 60 * 2 
  });
  const { data: coursesData } = trpc.course.list.useQuery(undefined, { 
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 60 
  });

  const { data: reservationDetails, refetch: refetchDetails } = trpc.calendar.getReservationDetails.useQuery(
    selectedEvent ? { reservationId: selectedEvent.id } : skipToken
  );

  const { data: conflictSuggestions, isLoading: suggestionsLoading, refetch: refetchSuggestions } = trpc.calendar.getConflictSuggestions.useQuery(
    {
      labId: reservationDetails?.labId ?? 0,
      startTime: reservationDetails?.startTime ? new Date(reservationDetails.startTime).toISOString() : new Date().toISOString(),
      endTime: reservationDetails?.endTime ? new Date(reservationDetails.endTime).toISOString() : new Date().toISOString(),
      excludeReservationId: selectedEvent?.id ?? 0,
    },
    {
      enabled: false,
    }
  );

  const approveMutation = trpc.reservation.approve.useMutation();
  const rejectMutation = trpc.reservation.reject.useMutation();
  const cancelMutation = trpc.reservation.cancel.useMutation();
  const updateMutation = trpc.reservation.update.useMutation();

  const { data: conflictDetails } = trpc.reservation.getConflictDetails.useQuery(
    selectedEvent ? { reservationId: selectedEvent.id } : skipToken
  );

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
    { staleTime: 1000 * 60 * 5 }
  );

  const { data: labCalendarData, isLoading: labCalendarLoading } = trpc.calendar.getLabCalendar.useQuery(
    dimension === 'lab' && selectedLab
      ? {
          labId: selectedLab,
          startDate: startOfMonth(currentDate).toISOString(),
          endDate: endOfMonth(currentDate).toISOString(),
          viewType: viewType,
        }
      : skipToken,
    { staleTime: 1000 * 60 * 10, gcTime: 1000 * 60 * 30 }
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
    { staleTime: 1000 * 60 * 15, gcTime: 1000 * 60 * 60 }
  );

  const checkEventConflict = (event: CalendarEvent): boolean => {
    return events.some(otherEvent => {
      if (otherEvent.id === event.id) return false;
      if (otherEvent.status !== 'approved' && otherEvent.status !== 'pending') return false;
      const overlap = !(event.endTime <= otherEvent.startTime || event.startTime >= otherEvent.endTime);
      return overlap;
    });
  };

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

    if (calendarData?.events) {
      let convertedEvents = calendarData.events.map((e: any) => ({
        ...e,
        startTime: new Date(e.startTime),
        endTime: new Date(e.endTime),
      }));

      const uniqueEvents = convertedEvents.reduce((acc: CalendarEvent[], current: CalendarEvent) => {
        const exists = acc.find(e => e.id === current.id);
        if (!exists) {
          acc.push(current);
        }
        return acc;
      }, []);

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
  };

  const handleConflictCheck = async () => {
    if (reservationDetails) {
      await refetchSuggestions();
`

1.5 日历导出（前端代码）
File: client/src/pages/CalendarDashboard.tsx (L344-433)
`tsx
  const handleExportCalendar = (exportFormat: 'html' | 'ics' | 'pdf' = 'ics') => {
    if (events.length === 0) {
      alert('当前没有可导出的预约事件');
      return;
    }

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

    if (exportFormat === 'ics') {
      exportToICalendar(exportEvents, filename);
    } else if (exportFormat === 'pdf') {
      exportToHTML(exportEvents, filename, { title, subtitle });
      setTimeout(() => window.print(), 500);
    } else {
      exportToHTML(exportEvents, filename, { title, subtitle });
    }
  };

  const handleApplyAlternativeSlot = async (slot: AlternativeSlot, bypassAdvanceRule = false) => {
    if (!selectedEvent || !reservationDetails) return;
    
    const isAdmin = user?.role === 'labAdmin' || user?.role === 'sysAdmin';
    const slotTimeStr = `${format(slot.startTime, 'yyyy/MM/dd HH:mm')} - ${format(slot.endTime, 'HH:mm')}`;
    
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
        bypassAdvanceRule,
      });
      
      if (result.needsReApproval) {
        alert('预约时间已更新，状态已改为待审核，请等待管理员审批。' + (bypassAdvanceRule ? '\n\n已使用管理员权限绕过提前预约规则。' : ''));
      } else {
        alert('预约时间已更新成功！');
      }
      
      setSelectedEvent(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['calendar'], exact: false }),
        queryClient.invalidateQueries({ queryKey: ['reservation'], exact: false }),
      ]);
    } catch (error: any) {
      alert('更新失败：' + (error.message || '未知错误'));
    }
  };

  return (
`

1.6 预约规则预检查 Hook（前端代码）
File: client/src/hooks/useReservationRules.ts (L1-116)
`ts
import { useCallback, useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";

export function useReservationRules() {
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [isChecking, setIsChecking] = useState(false);
  const [preCheckParams, setPreCheckParams] = useState<{
    labId: number;
    startTime: Date;
    endTime: Date;
  } | null>(null);
  const [conflictingReservations, setConflictingReservations] = useState<any[]>([]);

  const { data: enabledRules } = trpc.rule.listEnabled.useQuery();

  const { data: preCheckResult } = trpc.rule.preCheck.useQuery(
    preCheckParams as any,
    {
      enabled: !!preCheckParams,
    }
  );

  const { data: conflictDetails } = trpc.rule.getConflictingReservations.useQuery(
    preCheckParams as any,
    {
      enabled: !!preCheckParams && preCheckResult && !preCheckResult.valid,
    }
  );

  const checkReservation = useCallback(
    (labId: number, startTime: Date, endTime: Date) => {
      setIsChecking(true);
      setPreCheckParams({ labId, startTime, endTime });
    },
    []
  );

  useEffect(() => {
    if (preCheckResult) {
      if (!preCheckResult.valid) {
        setErrorMessage(preCheckResult.reason || "预约不符合规则要求");
      } else {
        setErrorMessage("");
        setConflictingReservations([]);
      }
      setIsChecking(false);
    }
  }, [preCheckResult]);

  useEffect(() => {
    if (conflictDetails) {
      setConflictingReservations(conflictDetails);
    }
  }, [conflictDetails]);

  useEffect(() => {
    if (!preCheckParams) {
      setErrorMessage("");
      setConflictingReservations([]);
    }
  }, [preCheckParams]);

  const formatRuleDescription = useCallback(() => {
    if (!enabledRules) return [];

    const descriptions: string[] = [];
    const ruleMap = new Map(enabledRules.map(r => [r.ruleCode, r]));

    const maxPerDay = ruleMap.get("MAX_PER_DAY");
    if (maxPerDay) {
      descriptions.push(`每日最多预约 ${maxPerDay.ruleValue} 次`);
    }

    const maxDuration = ruleMap.get("MAX_DURATION");
    if (maxDuration) {
      descriptions.push(`单次预约最长 ${maxDuration.ruleValue} 小时`);
    }

    const advanceDays = ruleMap.get("ADVANCE_DAYS");
    if (advanceDays) {
      descriptions.push(`需提前至少 ${advanceDays.ruleValue} 天预约`);
    }

    return descriptions;
  }, [enabledRules]);

  return {
    checkReservation,
    errorMessage,
    isChecking,
    enabledRules,
    formatRuleDescription,
    conflictingReservations,
  };
}
`

2.管理员端

2.1 预约审核（前端代码）
File: client/src/pages/ReservationManage.tsx (L1-250)
`tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const statusMap = {
  pending: { label: "待审核", color: "text-yellow-600" },
  approved: { label: "已通过", color: "text-green-600" },
  rejected: { label: "已拒绝", color: "text-red-600" },
  cancelled: { label: "已取消", color: "text-gray-600" },
  completed: { label: "已完成", color: "text-blue-600" },
  violated: { label: "已违约", color: "text-red-900" },
};

export default function ReservationManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'personal' | 'course'>('personal');
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [labFilter, setLabFilter] = useState<number | undefined>(undefined);

  const { data: labs } = trpc.labRoom.list.useQuery();

  const { data: reservationsPage, isLoading } = trpc.reservation.allList.useQuery({ page, pageSize, q: searchText || undefined, status: statusFilter, labId: labFilter });
  const utils = trpc.useUtils();

  const approveMutation = trpc.reservation.approve.useMutation({
    onSuccess: () => {
      toast.success("预约已通过");
      utils.reservation.allList.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectMutation = trpc.reservation.reject.useMutation({
    onSuccess: () => {
      toast.success("预约已拒绝");
      utils.reservation.allList.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleReject = () => {
    if (!selectedId || !rejectReason.trim()) {
      toast.error("请填写拒绝原因");
      return;
    }
    rejectMutation.mutate({ 
      id: selectedId, 
      rejectReason,
    });
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">预约审核</h2>
          <p className="text-gray-600">审核和管理所有预约申请</p>
        </div>

        <div className="px-4 py-4">
          <div className="flex gap-2 items-center mb-4">
            <input
              className="border rounded px-2 py-1"
              placeholder="搜索标题或理由"
              value={searchText}
              onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
            />
            <select className="border rounded px-2 py-1" value={statusFilter || ''} onChange={(e) => { setStatusFilter(e.target.value || undefined); setPage(1); }}>
              <option value="">全部状态</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="rejected">已拒绝</option>
              <option value="cancelled">已取消</option>
            </select>
            <select className="border rounded px-2 py-1" value={labFilter ?? ''} onChange={(e) => { setLabFilter(e.target.value ? Number(e.target.value) : undefined); setPage(1); }}>
              <option value="">全部实验室</option>
              {labs?.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
            </select>
          </div>

          {isLoading ? (
          <div className="text-center py-12">加载中...</div>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>实验室</TableHead>
                      <TableHead>预约标题</TableHead>
                      <TableHead>申请人</TableHead>
                      <TableHead>人数</TableHead>
                      <TableHead>开始时间</TableHead>
                      <TableHead>结束时间</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {reservationsPage?.items.map((reservation: any) => (
                      <TableRow key={`${reservation.reservationType || 'personal'}-${reservation.id}`}>
                        <TableCell>
                          <div className="flex flex-col gap-1">
                            <span>{reservation.labRoom?.name || '未知'}</span>
                            <span className="text-xs text-gray-400 px-1.5 py-0.5 bg-gray-50 rounded w-fit">
                              {reservation.reservationType === 'course' ? '课程预约' : '个人预约'}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{reservation.title}</div>
                            {reservation.course && reservation.reservationType === 'course' && (
                              <div className="text-xs text-blue-600 mt-1">课程: {reservation.course.name}</div>
                            )}
                            {reservation.reason && (
                              <div className="text-xs text-gray-500 mt-1">{reservation.reason}</div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>{reservation.userId}</TableCell>
                        <TableCell>{reservation.peopleCount || '-'}</TableCell>
                        <TableCell>
                          {format(new Date(reservation.startTime), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          {format(new Date(reservation.endTime), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <span className={statusMap[reservation.status as keyof typeof statusMap].color}>
                            {statusMap[reservation.status as keyof typeof statusMap].label}
                          </span>
                          {reservation.status === 'rejected' && reservation.rejectReason && (
                            <div className="text-xs text-gray-500 mt-1">
                              原因: {reservation.rejectReason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          {reservation.status === 'pending' && (
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => approveMutation.mutate({ 
                                  id: reservation.id,
                                })}
                                disabled={approveMutation.isPending}
                              >
                                通过
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setSelectedId(reservation.id);
                                  setSelectedType(reservation.reservationType || 'personal');
                                  setRejectDialogOpen(true);
                                }}
                              >
                                拒绝
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between p-4">
                  <div className="text-sm text-gray-600">共 {reservationsPage?.total ?? 0} 条</div>
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>上一页</Button>
                    <div className="px-2">第 {page} 页</div>
                    <Button size="sm" variant="outline" disabled={(reservationsPage?.total ?? 0) <= page * pageSize} onClick={() => setPage(p => p + 1)}>下一页</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>

      <Dialog open={rejectDialogOpen} onOpenChange={(open) => {
        setRejectDialogOpen(open);
        if (!open) {
          setRejectReason("");
          setSelectedId(null);
          setSelectedType('personal');
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>拒绝预约</DialogTitle>
            <DialogDescription>请填写拒绝原因</DialogDescription>
          </DialogHeader>
          <div>
            <Label>拒绝原因</Label>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="请说明拒绝的原因..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleReject} disabled={rejectMutation.isPending}>
              {rejectMutation.isPending ? '提交中...' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
`

2.2 规则配置（前端代码）
File: client/src/pages/RuleManage.tsx (L1-164)
`tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function RuleManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedRule, setSelectedRule] = useState<any>(null);
  const [ruleValue, setRuleValue] = useState("");
  const [ruleStatus, setRuleStatus] = useState<"enabled" | "disabled">("enabled");

  const { data: rules, isLoading } = trpc.rule.list.useQuery();
  const utils = trpc.useUtils();

  const updateMutation = trpc.rule.update.useMutation({
    onSuccess: () => {
      toast.success("规则更新成功");
      utils.rule.list.invalidate();
      setEditDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleEdit = (rule: any) => {
    setSelectedRule(rule);
    setRuleValue(rule.ruleValue);
    setRuleStatus(rule.status);
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!selectedRule) return;
    updateMutation.mutate({
      id: selectedRule.id,
      ruleValue,
      status: ruleStatus,
    });
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">预约规则配置</h2>
          <p className="text-gray-600">管理系统预约规则和限制</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>规则编码</TableHead>
                    <TableHead>规则名称</TableHead>
                    <TableHead>规则值</TableHead>
                    <TableHead>说明</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules?.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="font-mono text-sm">{rule.ruleCode}</TableCell>
                      <TableCell>{rule.ruleName}</TableCell>
                      <TableCell className="font-semibold">{rule.ruleValue}</TableCell>
                      <TableCell className="text-sm text-gray-600">{rule.description}</TableCell>
                      <TableCell>
                        <span className={rule.status === 'enabled' ? 'text-green-600' : 'text-gray-600'}>
                          {rule.status === 'enabled' ? '启用' : '停用'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="outline" onClick={() => handleEdit(rule)}>
                          编辑
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">规则说明</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• <strong>MAX_PER_DAY</strong>: 每位学生每日最多可预约的次数</li>
            <li>• <strong>MAX_DURATION</strong>: 单次预约的最长时长（小时）</li>
            <li>• <strong>ADVANCE_DAYS</strong>: 必须提前预约的天数</li>
          </ul>
        </div>
      </main>

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑规则</DialogTitle>
            <DialogDescription>
              {selectedRule?.ruleName} ({selectedRule?.ruleCode})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>规则值</Label>
              <Input
                type="text"
                value={ruleValue}
                onChange={(e) => setRuleValue(e.target.value)}
                placeholder="输入规则值"
              />
              <p className="text-xs text-gray-500 mt-1">{selectedRule?.description}</p>
            </div>
            <div>
              <Label>状态</Label>
              <Select value={ruleStatus} onValueChange={(value: "enabled" | "disabled") => setRuleStatus(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
              {updateMutation.isPending ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
`

2.3 审批配置（前端代码）
File: client/src/pages/ApprovalConfig.tsx (L85-254)
`tsx
export default function ApprovalConfigPage() {
  const [selectedLabId, setSelectedLabId] = useState<number | null>(null);
  const [isGlobal, setIsGlobal] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const { data: labs = [] } = trpc.labRoom.list.useQuery();
  const { data: config, isLoading, refetch } = trpc.approval.getConfigForLab.useQuery({ 
    labId: selectedLabId ?? 1 
  });

  const DEFAULT_CONFIG = useMemo(() => ({
    name: "",
    enableMultiLevel: 1,
    approvalStages: "[]",
    rescheduleWindowHours: 24,
    maxRescheduleCount: 2,
    autoCancelHours: 1,
  }), []);

  const [formData, setFormData] = useState(DEFAULT_CONFIG);

  useEffect(() => {
    if (config) {
      setFormData(prev => {
        const configData = {
          name: config.name || "",
          enableMultiLevel: config.enableMultiLevel || 1,
          approvalStages: config.approvalStages || "[]",
          rescheduleWindowHours: config.rescheduleWindowHours ?? 24,
          maxRescheduleCount: config.maxRescheduleCount ?? 2,
          autoCancelHours: Number(config.autoCancelHours) || 1,
        };
        if (JSON.stringify(prev) !== JSON.stringify(configData)) {
          return configData;
        }
        return prev;
      });
    }
  }, [config]);

  const updateConfig = trpc.approval.updateConfig.useMutation({
    onSuccess: () => {
      setIsSaving(false);
      toast.success("保存成功 - 审批配置已更新");
      refetch();
    },
    onError: (error: any) => {
      setIsSaving(false);
      toast.error(`保存失败 - ${error.message}`);
    }
  });

  const handleSave = () => {
    setIsSaving(true);
    updateConfig.mutate({
      labId: isGlobal ? null : (selectedLabId ?? null),
      ...formData,
    } as any);
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans text-slate-900">
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Settings className="h-6 w-6 text-indigo-600" />
            审批配置管理
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            自定义预约审批流程、调整规则及自动化设置。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 bg-white">
            <RefreshCw className="h-4 w-4" />
            重置更改
          </Button>
          <Button onClick={handleSave} disabled={isSaving} className="gap-2">
            {isSaving ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            保存配置
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
        
        <div className="lg:col-span-2 space-y-6">
          
          <Card className={cn("transition-all duration-300", isGlobal ? "border-indigo-200 shadow-indigo-50" : "border-slate-200")}>
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <Globe className={cn("h-5 w-5", isGlobal ? "text-indigo-600" : "text-slate-400")} />
                    配置生效范围
                  </h3>
                  <p className="text-sm text-slate-500">
                    选择配置是应用于所有实验室还是特定房间
                  </p>
                </div>
                <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-lg border">
                  <button 
                    onClick={() => { setIsGlobal(true); setSelectedLabId(null); }}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                      isGlobal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    全局默认
                  </button>
                  <button 
                    onClick={() => { setIsGlobal(false); if(!selectedLabId) setSelectedLabId(labs[0]?.id); }}
                    className={cn(
                      "px-3 py-1.5 text-sm font-medium rounded-md transition-all",
                      !isGlobal ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-900"
                    )}
                  >
                    特定实验室
                  </button>
                </div>
              </div>
            </CardHeader>
            
            {!isGlobal && (
              <CardContent className="pt-0 border-t border-slate-100/50">
                 <div className="mt-4 animate-in slide-in-from-top-2 duration-200">
                   <Label className="mb-2 block">选择目标实验室</Label>
                   <div className="relative">
                      <select 
                        className="w-full h-10 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={selectedLabId || ""}
                        onChange={(e) => setSelectedLabId(Number(e.target.value))}
                      >
                        {labs.map((lab: any) => (
                          <option key={lab.id} value={lab.id}>{lab.roomNo} - {lab.name}</option>
                        ))}
                      </select>
                      <Building2 className="absolute right-3 top-2.5 h-5 w-5 text-slate-400 pointer-events-none" />
                   </div>
                 </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <GitCommit className="h-5 w-5 text-slate-600" />
                审批流程设计
              </h3>
              <p className="text-sm text-slate-500">定义预约申请需要经过的审核节点</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-4">
                 <div className="space-y-2">
                    <Label>审批层级数</Label>
                    <input
`

2.4 违约与黑名单管理（前端代码）
File: client/src/pages/ViolationManage.tsx (L39-228)
`tsx
const violationTypeMap: Record<string, { label: string; icon: ElementType; color: string; bg: string }> = {
  no_show: { label: "未签到", icon: UserX, color: "text-rose-600", bg: "bg-rose-50" },
  late_cancel: { label: "迟到取消", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  damage: { label: "设备损坏", icon: ShieldAlert, color: "text-purple-600", bg: "bg-purple-50" },
  other: { label: "违反规则", icon: Ban, color: "text-slate-600", bg: "bg-slate-50" },
};

const restrictionTypeMap: Record<string, string> = {
  time_limit: "禁止预约 (7天)",
  resource_limit: "限制高配设备",
};

export default function ViolationManagePage() {
  const [searchUserId, setSearchUserId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedBlacklist, setSelectedBlacklist] = useState<any>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const { data: violations = [], refetch: refetchViolations } = trpc.violation.getAllRecords.useQuery();
  const { data: blacklistData = [], refetch: refetchBlacklist } = trpc.violation.getAllBlacklist.useQuery();
  const { data: classList = [] } = trpc.class.list.useQuery();

  const removeBlacklist = trpc.violation.removeBlacklist.useMutation({
    onSuccess: () => {
      toast.success("移除成功");
      refetchBlacklist();
      setIsRemoveDialogOpen(false);
      setSelectedBlacklist(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredViolations = useMemo(() => {
    let list = violations;
    if (selectedClassId !== "all") {
      list = list.filter((v: any) => `${v.classId ?? ""}` === selectedClassId);
    }
    if (searchUserId) {
      list = list.filter(
        (v: any) => v.userId?.toString().includes(searchUserId) || v.userName?.includes(searchUserId)
      );
    }
    return list;
  }, [violations, searchUserId, selectedClassId]);

  const totalPoints = useMemo(
    () => violations.reduce((sum: number, v: any) => sum + (v.points || 0), 0),
    [violations]
  );

  const filteredBlacklist = useMemo(() => {
    if (selectedClassId === "all") return blacklistData;
    return blacklistData.filter((item: any) => `${item.classId ?? ""}` === selectedClassId);
  }, [blacklistData, selectedClassId]);

  const handleRemoveBlacklist = () => {
    if (!selectedBlacklist) return;
    removeBlacklist.mutate({ userId: selectedBlacklist.userId });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans text-slate-900">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Gavel className="h-6 w-6 text-rose-600" /> 违约与黑名单管理
        </h1>
        <p className="text-slate-500 text-sm">维护实验室秩序，管理违规记录及用户处罚状态。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约记录</p>
              <h2 className="text-3xl font-bold text-slate-900">{violations.length}</h2>
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> 需关注趋势
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
              <History className="h-6 w-6 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">黑名单用户</p>
              <h2 className="text-3xl font-bold text-slate-900">{filteredBlacklist.length}</h2>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Ban className="h-3 w-3" /> 限制中
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
              <UserX className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约积分</p>
              <h2 className="text-3xl font-bold text-slate-900">{totalPoints}</h2>
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> 累计扣分
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { title: "无故缺席", code: "no_show", points: 5, desc: "预约获批但未到场签到", color: "bg-rose-50 border-rose-100 text-rose-700", icon: UserX },
          { title: "迟到取消", code: "late_cancel", points: 2, desc: "开始前24小时内取消", color: "bg-amber-50 border-amber-100 text-amber-700", icon: Clock },
          { title: "超时占用", code: "timeout", points: 3, desc: "未及时签出归还实验室", color: "bg-orange-50 border-orange-100 text-orange-700", icon: History },
          { title: "其他违规", code: "manual", points: "Custom", desc: "设备损坏或违反管理规定", color: "bg-slate-100 border-slate-200 text-slate-700", icon: AlertTriangle },
        ].map((rule) => (
          <div
            key={rule.code}
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-2 transition-transform hover:scale-[1.02]",
              rule.color
            )}
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/60 rounded-lg">
                <rule.icon className="h-5 w-5 opacity-80" />
              </div>
              <span className="text-xl font-bold opacity-40">
                {typeof rule.points === "number" ? `-${rule.points}` : "N"}
              </span>
            </div>
            <div>
              <h4 className="font-semibold">{rule.title}</h4>
              <p className="text-xs opacity-80 mt-1 leading-relaxed">{rule.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-500" /> 黑名单管理
            </h3>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {filteredBlacklist.length} 人受限
            </Badge>
          </div>

          <Card className="overflow-hidden border-amber-200/60">
            <div className="divide-y divide-slate-100">
              {filteredBlacklist.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">暂无黑名单用户</div>
              ) : (
                filteredBlacklist.map((item: any) => (
                  <div key={item.id || item.userId} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                          {item.userName?.[0] || "?"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{item.userName || "-"}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: {item.userId}</div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-100">
                        积分 {item.totalViolationPoints}
                      </Badge>
                    </div>

                    <div className="space-y-2 mt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">限制类型</span>
                        <span className="font-medium text-slate-900">
                          {restrictionTypeMap[item.restrictionType] || item.restrictionType || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">解禁时间</span>
                        <span className="font-medium text-slate-900">
                          {item.restrictedUntil
`

2.5 审计日志（前端代码）
File: client/src/pages/AuditLog.tsx (L50-239)
`tsx
export default function AuditLogPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const targetIdFromUrl = urlParams.get('targetId');
  
  const [filters, setFilters] = useState({
    type: "all",
    operatorId: "",
    startDate: "",
    endDate: "",
    targetId: targetIdFromUrl || "",
  });
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const { data: allLogs = [], isLoading, refetch } = trpc.audit.getLogs.useQuery({
    operationType: filters.type && filters.type !== "all" ? filters.type : undefined,
    targetType: undefined,
    startDate: filters.startDate ? new Date(filters.startDate) : undefined,
    endDate: filters.endDate ? new Date(filters.endDate) : undefined,
    limit: 1000,
  });

  const logs = useMemo(() => {
    if (!filters.targetId) return allLogs;
    const targetIdNum = parseInt(filters.targetId);
    return allLogs.filter((log: any) => log.targetId === targetIdNum);
  }, [allLogs, filters.targetId]);

  const operationTypeMap: Record<
    string,
    { label: string; variant: "info" | "approved" | "rejected" | "pending" | "restricted"; icon: ElementType }
  > = {
    reservation_create: { label: "创建预约", variant: "info", icon: Calendar },
    reservation_approve: { label: "审批通过", variant: "approved", icon: ShieldCheck },
    reservation_reject: { label: "拒绝预约", variant: "rejected", icon: ShieldAlert },
    reservation_cancel: { label: "取消预约", variant: "rejected", icon: X },
    violation_record: { label: "违约记录", variant: "rejected", icon: ShieldAlert },
    blacklist_add: { label: "加入黑名单", variant: "restricted", icon: Shield },
    blacklist_remove: { label: "移除黑名单", variant: "approved", icon: ShieldCheck },
    config_update: { label: "系统配置", variant: "pending", icon: Activity },
    course_create: { label: "创建课程", variant: "info", icon: Calendar },
    course_update: { label: "更新课程", variant: "pending", icon: Activity },
    course_delete: { label: "删除课程", variant: "rejected", icon: X },
    course_student_add: { label: "添加学生", variant: "approved", icon: ShieldCheck },
    course_reservation_create: { label: "课程预约", variant: "info", icon: Calendar },
    course_reservation_cancel: { label: "取消课程预约", variant: "rejected", icon: ShieldAlert },
    lab_update: { label: "更新实验室", variant: "pending", icon: Activity },
    rule_update: { label: "更新规则", variant: "pending", icon: Activity },
  };

  const stats = useMemo(
    () => ({
      total: logs.length,
      today: logs.filter((l: any) =>
        l.operatedAt && format(new Date(l.operatedAt), "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd")
      ).length,
      violations: logs.filter((l: any) => l.operationType === "violation_record").length,
      approvals: logs.filter((l: any) => l.operationType?.includes("approve") || l.operationType?.includes("reject")).length,
    }),
    [logs]
  );

  const variantIconClass: Record<typeof operationTypeMap[keyof typeof operationTypeMap]["variant"], string> = {
    info: "text-blue-600",
    approved: "text-green-600",
    rejected: "text-red-600",
    pending: "text-yellow-600",
    restricted: "text-purple-600",
  };

  const handleViewDetail = (log: any) => {
    setSelectedLog(log);
    setIsDetailOpen(true);
  };

  const handleClearFilters = () => {
    setFilters({
      type: "all",
      operatorId: "",
      targetId: "",
      startDate: "",
      endDate: "",
    });
  };

  const safeDetails = useMemo(() => {
    if (!selectedLog?.details) return null;
    if (typeof selectedLog.details !== "string") return selectedLog.details;
    try {
      return JSON.parse(selectedLog.details);
    } catch (error) {
      return selectedLog.details;
    }
  }, [selectedLog]);

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Shield className="h-6 w-6 text-slate-700" /> 审计日志
          </h1>
          <p className="text-slate-500 text-sm mt-1">监控系统关键操作，追踪安全事件与变更记录。</p>
          {filters.targetId && (
            <div className="mt-2 text-xs text-blue-600 bg-blue-50 border border-blue-200 rounded-md px-3 py-1 inline-flex items-center gap-2">
              <FileText className="w-3 h-3" />
              正在查看目标ID为 <span className="font-mono font-bold">{filters.targetId}</span> 的相关日志
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} className="gap-2 bg-white">
            <RefreshCw className="h-4 w-4" /> 刷新数据
          </Button>
          <Button variant="outline" size="sm" className="gap-2 bg-white">
            <Download className="h-4 w-4" /> 导出 CSV
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "总日志条数", value: stats.total, icon: FileText, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "今日操作", value: stats.today, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "违约记录", value: stats.violations, icon: ShieldAlert, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "审批操作", value: stats.approvals, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
        ].map((stat, idx) => (
          <Card key={idx} className="hover:shadow-md transition-shadow border-slate-200 h-full">
            <CardContent className="p-4 pt-4 flex items-center gap-4 h-full">
              <div className={cn("p-3 rounded-lg shrink-0", stat.bg)}>
                <stat.icon className={cn("h-5 w-5", stat.color)} />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">{stat.label}</p>
                <p className="text-2xl font-bold text-slate-900 leading-none mt-1">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 p-4 bg-white flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-1 flex-col sm:flex-row gap-3 w-full lg:w-auto">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="搜索操作员ID、目标ID..."
                className="pl-9 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                value={filters.operatorId}
                onChange={(e) => setFilters({ ...filters, operatorId: e.target.value })}
              />
            </div>

            <Input
              placeholder="目标ID"
              className="w-full sm:w-32 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
              value={filters.targetId}
              onChange={(e) => setFilters({ ...filters, targetId: e.target.value })}
            />

            <Select value={filters.type} onValueChange={(val) => setFilters({ ...filters, type: val })}>
              <SelectTrigger className="h-10 w-full sm:w-40 rounded-md border-slate-200 bg-slate-50">
                <SelectValue placeholder="所有类型" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">所有类型</SelectItem>
                {Object.entries(operationTypeMap).map(([key, val]) => (
                  <SelectItem key={key} value={key}>
                    {val.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2 w-full sm:w-auto">
              <Input
                type="date"
                className="w-full sm:w-auto bg-slate-50 border-slate-200"
                value={filters.startDate}
                onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              />
              <Input
                type="date"
                className="w-full sm:w-auto bg-slate-50 border-slate-200"
                value={filters.endDate}
                onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              />
`

3.后端核心

3.1 服务启动入口（后端代码）
File: server/_core/index.ts (L1-66)
`ts
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
`

3.2 OAuth 回调（后端代码）
File: server/_core/oauth.ts (L1-78)
`ts
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";

function getQueryParam(req: Request, key: string): string | undefined {
  const value = req.query[key];
  return typeof value === "string" ? value : undefined;
}

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/authorize", async (req: Request, res: Response) => {
    const mockOAuthUrl = process.env.VITE_OAUTH_AUTHORIZE_URL ?? "http://localhost:4000/oauth/authorize";
    const queryParams = new URLSearchParams(req.query as Record<string, string>);
    const redirectUrl = `${mockOAuthUrl}?${queryParams.toString()}`;
    res.redirect(302, redirectUrl);
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    const code = getQueryParam(req, "code");
    const state = getQueryParam(req, "state");

    if (!code || !state) {
      res.status(400).json({ error: "code and state are required" });
      return;
    }

    try {
      console.log("[OAuth] Starting callback with code:", code, "state:", state);
      
      const tokenResponse = await sdk.exchangeCodeForToken(code, state);
      console.log("[OAuth] Got token:", tokenResponse.accessToken);
      
      const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);
      console.log("[OAuth] Got userInfo:", JSON.stringify(userInfo));

      if (!userInfo.openId) {
        console.error("[OAuth] Missing openId in userInfo");
        res.status(400).json({ error: "openId missing from user info" });
        return;
      }

      const validRoles = ['student', 'teacher', 'labAdmin', 'sysAdmin'];
      const role = userInfo.role && validRoles.includes(userInfo.role) ? userInfo.role as 'student' | 'teacher' | 'labAdmin' | 'sysAdmin' : undefined;
      
      console.log("[OAuth] User role:", userInfo.role, "-> validated role:", role);

      await db.upsertUser({
        openId: userInfo.openId,
        name: userInfo.name || null,
        email: userInfo.email ?? null,
        loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
        lastSignedIn: new Date(),
        role: role,
      });

      console.log("[OAuth] User upserted successfully");

      const sessionToken = await sdk.createSessionToken(userInfo.openId, {
        name: userInfo.name || "",
        expiresInMs: ONE_YEAR_MS,
      });

      const cookieOptions = getSessionCookieOptions(req);
      res.cookie(COOKIE_NAME, sessionToken, { ...cookieOptions, maxAge: ONE_YEAR_MS });

      console.log("[OAuth] Session cookie set, redirecting to /");
      res.redirect(302, "/");
    } catch (error) {
      console.error("[OAuth] Callback failed", error);
      res.status(500).json({ error: "OAuth callback failed" });
    }
  });
}
`

3.3 tRPC 初始化与权限中间件（后端代码）
File: server/_core/trpc.ts (L1-49)
`ts
import { NOT_ADMIN_ERR_MSG, UNAUTHED_ERR_MSG } from '@shared/const';
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const requireUser = t.middleware(async opts => {
  const { ctx, next } = opts;

  if (!ctx.user) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: UNAUTHED_ERR_MSG });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

export const protectedProcedure = t.procedure.use(requireUser);

export const adminProcedure = t.procedure.use(
  t.middleware(async opts => {
    const { ctx, next } = opts;

    const isAdmin = ctx.user && (ctx.user.role === 'sysAdmin' || ctx.user.role === 'labAdmin');
    
    if (!isAdmin) {
      throw new TRPCError({ code: "FORBIDDEN", message: NOT_ADMIN_ERR_MSG });
    }

    return next({
      ctx: {
        ...ctx,
        user: ctx.user,
      },
    });
  })
);
`3.4 违约与黑名单管理（前端代码）
File: client/src/pages/ViolationManage.tsx (L1-320)
~~~tsx
﻿import { useMemo, useState, type ElementType } from "react";
import {
  AlertTriangle,
  Ban,
  ShieldAlert,
  Trash2,
  UserX,
  Search,
  Clock,
  AlertCircle,
  Gavel,
  History,
  Info,
} from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

const violationTypeMap: Record<string, { label: string; icon: ElementType; color: string; bg: string }> = {
  no_show: { label: "未签到", icon: UserX, color: "text-rose-600", bg: "bg-rose-50" },
  late_cancel: { label: "迟到取消", icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
  damage: { label: "设备损坏", icon: ShieldAlert, color: "text-purple-600", bg: "bg-purple-50" },
  other: { label: "违反规则", icon: Ban, color: "text-slate-600", bg: "bg-slate-50" },
};

const restrictionTypeMap: Record<string, string> = {
  time_limit: "禁止预约 (7天)",
  resource_limit: "限制高配设备",
};

export default function ViolationManagePage() {
  const [searchUserId, setSearchUserId] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<string>("all");
  const [selectedBlacklist, setSelectedBlacklist] = useState<any>(null);
  const [isRemoveDialogOpen, setIsRemoveDialogOpen] = useState(false);

  const { data: violations = [], refetch: refetchViolations } = trpc.violation.getAllRecords.useQuery();
  const { data: blacklistData = [], refetch: refetchBlacklist } = trpc.violation.getAllBlacklist.useQuery();
  const { data: classList = [] } = trpc.class.list.useQuery();

  const removeBlacklist = trpc.violation.removeBlacklist.useMutation({
    onSuccess: () => {
      toast.success("移除成功");
      refetchBlacklist();
      setIsRemoveDialogOpen(false);
      setSelectedBlacklist(null);
    },
    onError: (error) => toast.error(error.message),
  });

  const filteredViolations = useMemo(() => {
    let list = violations;
    if (selectedClassId !== "all") {
      list = list.filter((v: any) => `${v.classId ?? ""}` === selectedClassId);
    }
    if (searchUserId) {
      list = list.filter(
        (v: any) => v.userId?.toString().includes(searchUserId) || v.userName?.includes(searchUserId)
      );
    }
    return list;
  }, [violations, searchUserId, selectedClassId]);

  const totalPoints = useMemo(
    () => violations.reduce((sum: number, v: any) => sum + (v.points || 0), 0),
    [violations]
  );

  const filteredBlacklist = useMemo(() => {
    if (selectedClassId === "all") return blacklistData;
    return blacklistData.filter((item: any) => `${item.classId ?? ""}` === selectedClassId);
  }, [blacklistData, selectedClassId]);

  const handleRemoveBlacklist = () => {
    if (!selectedBlacklist) return;
    removeBlacklist.mutate({ userId: selectedBlacklist.userId });
  };

  return (
    <div className="min-h-screen bg-slate-50/50 p-6 space-y-8 font-sans text-slate-900">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
          <Gavel className="h-6 w-6 text-rose-600" /> 违约与黑名单管理
        </h1>
        <p className="text-slate-500 text-sm">维护实验室秩序，管理违规记录及用户处罚状态。</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-l-4 border-l-rose-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约记录</p>
              <h2 className="text-3xl font-bold text-slate-900">{violations.length}</h2>
              <p className="text-xs text-rose-600 mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> 需关注趋势
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-rose-50 flex items-center justify-center">
              <History className="h-6 w-6 text-rose-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">黑名单用户</p>
              <h2 className="text-3xl font-bold text-slate-900">{filteredBlacklist.length}</h2>
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                <Ban className="h-3 w-3" /> 限制中
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-amber-50 flex items-center justify-center">
              <UserX className="h-6 w-6 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm hover:shadow-md transition-all">
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">总违约积分</p>
              <h2 className="text-3xl font-bold text-slate-900">{totalPoints}</h2>
              <p className="text-xs text-blue-600 mt-1 flex items-center gap-1">
                <Info className="h-3 w-3" /> 累计扣分
              </p>
            </div>
            <div className="h-12 w-12 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldAlert className="h-6 w-6 text-blue-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {[
          { title: "无故缺席", code: "no_show", points: 5, desc: "预约获批但未到场签到", color: "bg-rose-50 border-rose-100 text-rose-700", icon: UserX },
          { title: "迟到取消", code: "late_cancel", points: 2, desc: "开始前24小时内取消", color: "bg-amber-50 border-amber-100 text-amber-700", icon: Clock },
          { title: "超时占用", code: "timeout", points: 3, desc: "未及时签出归还实验室", color: "bg-orange-50 border-orange-100 text-orange-700", icon: History },
          { title: "其他违规", code: "manual", points: "Custom", desc: "设备损坏或违反管理规定", color: "bg-slate-100 border-slate-200 text-slate-700", icon: AlertTriangle },
        ].map((rule) => (
          <div
            key={rule.code}
            className={cn(
              "p-4 rounded-xl border flex flex-col gap-2 transition-transform hover:scale-[1.02]",
              rule.color
            )}
          >
            <div className="flex justify-between items-start">
              <div className="p-2 bg-white/60 rounded-lg">
                <rule.icon className="h-5 w-5 opacity-80" />
              </div>
              <span className="text-xl font-bold opacity-40">
                {typeof rule.points === "number" ? `-${rule.points}` : "N"}
              </span>
            </div>
            <div>
              <h4 className="font-semibold">{rule.title}</h4>
              <p className="text-xs opacity-80 mt-1 leading-relaxed">{rule.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 items-start">
        <div className="xl:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Ban className="h-5 w-5 text-amber-500" /> 黑名单管理
            </h3>
            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
              {filteredBlacklist.length} 人受限
            </Badge>
          </div>

          <Card className="overflow-hidden border-amber-200/60">
            <div className="divide-y divide-slate-100">
              {filteredBlacklist.length === 0 ? (
                <div className="p-8 text-center text-slate-500 text-sm">暂无黑名单用户</div>
              ) : (
                filteredBlacklist.map((item: any) => (
                  <div key={item.id || item.userId} className="p-4 hover:bg-slate-50 transition-colors group">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 font-bold border border-slate-200">
                          {item.userName?.[0] || "?"}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900">{item.userName || "-"}</div>
                          <div className="text-xs text-slate-500 font-mono">ID: {item.userId}</div>
                        </div>
                      </div>
                      <Badge variant="destructive" className="bg-rose-50 text-rose-600 border-rose-100">
                        积分 {item.totalViolationPoints}
                      </Badge>
                    </div>

                    <div className="space-y-2 mt-3 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">限制类型</span>
                        <span className="font-medium text-slate-900">
                          {restrictionTypeMap[item.restrictionType] || item.restrictionType || "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">解禁时间</span>
                        <span className="font-medium text-slate-900">
                          {item.restrictedUntil
                            ? format(new Date(item.restrictedUntil), "yyyy-MM-dd", { locale: zhCN })
                            : "-"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2 rounded text-slate-600 border border-slate-100">
                        原因: {item.reason || "-"}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-50 flex justify-end">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-rose-600 hover:bg-rose-50 h-8"
                        onClick={() => {
                          setSelectedBlacklist(item);
                          setIsRemoveDialogOpen(true);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" /> 解除限制
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>

        <div className="xl:col-span-2 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <History className="h-5 w-5 text-slate-500" /> 违约记录
            </h3>
            <div className="flex w-full sm:w-auto gap-3 flex-col sm:flex-row">
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="搜索用户姓名或ID..."
                  className="pl-9 h-9"
                  value={searchUserId}
                  onChange={(e) => setSearchUserId(e.target.value)}
                />
              </div>
              <Select value={selectedClassId} onValueChange={setSelectedClassId}>
                <SelectTrigger className="h-9 w-full sm:w-48 bg-white">
                  <SelectValue placeholder="筛选班级" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部班级</SelectItem>
                  {classList.map((cls: any) => (
                    <SelectItem key={cls.id} value={`${cls.id}`}>
                      {cls.name || cls.classNo || `班级${cls.id}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500 uppercase bg-slate-50/50 border-b border-slate-200">
                  <tr>
                    <th className="px-6 py-3 font-medium">用户</th>
                    <th className="px-6 py-3 font-medium">违约类型</th>
                    <th className="px-6 py-3 font-medium">扣分</th>
                    <th className="px-6 py-3 font-medium">详情描述</th>
                    <th className="px-6 py-3 font-medium">记录时间</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredViolations.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                        暂无违约记录
                      </td>
                    </tr>
                  ) : (
                    filteredViolations.map((v: any) => {
                      const type = violationTypeMap[v.violationType] || violationTypeMap.other;
                      const TypeIcon = type.icon;

                      return (
                        <tr key={v.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-xs text-slate-600 font-bold">
                                {v.userName?.[0] || "?"}
                              </div>
                              <div>
实验室管理（前端代码）
File: client/src/pages/LabRoomManage.tsx (L1-260)
~~~tsx
import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

export default function LabRoomManage() {
  const { user } = useAuth();
  const { isLabAdmin, isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    roomNo: "",
    name: "",
    building: "",
    location: "",
    capacity: 0,
    type: "",
    openTimeStart: "08:00",
    openTimeEnd: "22:00",
    status: "enabled" as "enabled" | "disabled",
    remark: "",
  });

  const { data: labs, isLoading } = trpc.labRoom.list.useQuery();
  const utils = trpc.useUtils();

  const createMutation = trpc.labRoom.create.useMutation({
    onSuccess: () => {
      toast.success("实验室创建成功");
      utils.labRoom.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const updateMutation = trpc.labRoom.update.useMutation({
    onSuccess: () => {
      toast.success("实验室更新成功");
      utils.labRoom.list.invalidate();
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const deleteMutation = trpc.labRoom.delete.useMutation({
    onSuccess: () => {
      toast.success("实验室删除成功");
      utils.labRoom.list.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  if (!isLabAdmin && !isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleOpenDialog = (lab?: any) => {
    if (lab) {
      setEditingId(lab.id);
      setFormData({
        roomNo: lab.roomNo,
        name: lab.name,
        building: lab.building || "",
        location: lab.location || "",
        capacity: lab.capacity || 0,
        type: lab.type || "",
        openTimeStart: lab.openTimeStart || "08:00",
        openTimeEnd: lab.openTimeEnd || "22:00",
        status: lab.status,
        remark: lab.remark || "",
      });
    } else {
      setEditingId(null);
      setFormData({
        roomNo: "",
        name: "",
        building: "",
        location: "",
        capacity: 0,
        type: "",
        openTimeStart: "08:00",
        openTimeEnd: "22:00",
        status: "enabled",
        remark: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingId(null);
  };

  const handleSubmit = () => {
    if (editingId) {
      updateMutation.mutate({ id: editingId, ...formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">实验室管理</h2>
            <p className="text-gray-600">管理所有实验室信息</p>
          </div>
          <Button onClick={() => handleOpenDialog()}>添加实验室</Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">加载中...</div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>编号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>楼宇</TableHead>
                    <TableHead>位置</TableHead>
                    <TableHead>容量</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {labs?.map((lab) => (
                    <TableRow key={lab.id}>
                      <TableCell>{lab.roomNo}</TableCell>
                      <TableCell>{lab.name}</TableCell>
                      <TableCell>{lab.building}</TableCell>
                      <TableCell>{lab.location}</TableCell>
                      <TableCell>{lab.capacity}</TableCell>
                      <TableCell>{lab.type}</TableCell>
                      <TableCell>
                        <span className={lab.status === 'enabled' ? 'text-green-600' : 'text-gray-600'}>
                          {lab.status === 'enabled' ? '启用' : '停用'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => handleOpenDialog(lab)}>
                            编辑
                          </Button>
                          <Button 
                            size="sm" 
                            variant="outline" 
                            onClick={() => {
                              if (confirm('确定要删除这个实验室吗?')) {
                                deleteMutation.mutate({ id: lab.id });
                              }
                            }}
                          >
                            删除
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? '编辑实验室' : '添加实验室'}</DialogTitle>
            <DialogDescription>填写实验室基本信息</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>实验室编号</Label>
              <Input value={formData.roomNo} onChange={(e) => setFormData({ ...formData, roomNo: e.target.value })} />
            </div>
            <div>
              <Label>实验室名称</Label>
              <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div>
              <Label>所在楼宇</Label>
              <Input value={formData.building} onChange={(e) => setFormData({ ...formData, building: e.target.value })} />
            </div>
            <div>
              <Label>具体位置</Label>
              <Input value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
            </div>
            <div>
              <Label>容纳人数</Label>
              <Input type="number" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value) })} />
            </div>
            <div>
              <Label>实验室类型</Label>
              <Input value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} placeholder="例如：机房、物理实验室" />
            </div>
            <div>
              <Label>开放开始时间</Label>
              <Input type="time" value={formData.openTimeStart} onChange={(e) => setFormData({ ...formData, openTimeStart: e.target.value })} />
            </div>
            <div>
              <Label>开放结束时间</Label>
              <Input type="time" value={formData.openTimeEnd} onChange={(e) => setFormData({ ...formData, openTimeEnd: e.target.value })} />
            </div>
            <div>
              <Label>状态</Label>
              <Select value={formData.status} onValueChange={(value: "enabled" | "disabled") => setFormData({ ...formData, status: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="enabled">启用</SelectItem>
                  <SelectItem value="disabled">停用</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>备注</Label>
              <Textarea value={formData.remark} onChange={(e) => setFormData({ ...formData, remark: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>取消</Button>
            <Button onClick={handleSubmit} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) ? '保存中...' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}