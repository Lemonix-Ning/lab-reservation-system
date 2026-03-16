import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { format } from "date-fns";
import { FlaskConical, Calendar, BookOpen, Clock } from "lucide-react";
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

const weekDayMap: Record<number, string> = {
  1: '周一', 2: '周二', 3: '周三', 4: '周四', 5: '周五', 6: '周六', 7: '周日'
};

const weekTypeMap: Record<string, string> = {
  all: '每周', odd: '单周', even: '双周'
};

export default function ReservationManage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("reservations");
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedType, setSelectedType] = useState<'personal' | 'course' | 'schedule'>('personal');
  const [rejectReason, setRejectReason] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [labFilter, setLabFilter] = useState<number | undefined>(undefined);

  const { data: labs } = trpc.labRoom.list.useQuery();

  const { data: reservationsPage, isLoading } = trpc.reservation.allList.useQuery({ page, pageSize, q: searchText || undefined, status: statusFilter, labId: labFilter });
  
  // 课程排课审批
  const { data: pendingSchedules = [], isLoading: schedulesLoading } = trpc.classCheckin.getPendingSchedules.useQuery({ labId: labFilter });
  
  // 课程预约审批（临时预约）
  const { data: pendingCourseReservations = [], isLoading: courseReservationsLoading } = trpc.courseReservation.getPendingReservations.useQuery({ labId: labFilter });
  
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

  // 排课审批
  const approveScheduleMutation = trpc.classCheckin.approveSchedule.useMutation({
    onSuccess: () => {
      toast.success("排课已通过");
      utils.classCheckin.getPendingSchedules.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectScheduleMutation = trpc.classCheckin.rejectSchedule.useMutation({
    onSuccess: () => {
      toast.success("排课已拒绝");
      utils.classCheckin.getPendingSchedules.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 课程预约审批
  const approveCourseReservationMutation = trpc.courseReservation.approve.useMutation({
    onSuccess: () => {
      toast.success("课程预约已通过");
      utils.courseReservation.getPendingReservations.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const rejectCourseReservationMutation = trpc.courseReservation.reject.useMutation({
    onSuccess: () => {
      toast.success("课程预约已拒绝");
      utils.courseReservation.getPendingReservations.invalidate();
      setRejectDialogOpen(false);
      setRejectReason("");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  // 权限检查由后端API和菜单过滤处理

  const handleReject = () => {
    if (!selectedId || !rejectReason.trim()) {
      toast.error("请填写拒绝原因");
      return;
    }
    if (selectedType === 'schedule') {
      rejectScheduleMutation.mutate({ id: selectedId, reason: rejectReason });
    } else if (selectedType === 'course') {
      rejectCourseReservationMutation.mutate({ id: selectedId, reason: rejectReason });
    } else {
      rejectMutation.mutate({ id: selectedId, rejectReason });
    }
  };

  return (
    <div className="bg-gray-50">
      <main className="container py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">预约审核</h2>
          <p className="text-gray-600">审核和管理所有预约申请与课程排课</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="reservations" className="flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              个人预约
              {reservationsPage?.items?.filter((r: any) => r.status === 'pending').length ? (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                  {reservationsPage.items.filter((r: any) => r.status === 'pending').length}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="schedules" className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              课程排课
              {pendingSchedules.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                  {pendingSchedules.length}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="courseReservations" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              课程预约
              {pendingCourseReservations.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                  {pendingCourseReservations.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* 个人预约Tab */}
          <TabsContent value="reservations">
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
                          <TableHead>签到情况</TableHead>
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
                          {reservation.checkinTime ? (
                            <div className="text-xs space-y-1">
                              <div className={reservation.checkinMethod === 'geofence' ? 'text-green-600' : 'text-yellow-600'}>
                                {reservation.checkinMethod === 'geofence' && '📍 '}
                                {reservation.checkinMethod === 'manual' && '⚠️ '}
                                {reservation.checkinMethod === 'qrcode' && '📱 '}
                                签到: {format(new Date(reservation.checkinTime), "HH:mm")}
                              </div>
                              <div className="text-gray-400">
                                {reservation.checkinMethod === 'geofence' ? '位置验证' : 
                                 reservation.checkinMethod === 'manual' ? '手动（无位置）' :
                                 reservation.checkinMethod === 'qrcode' ? '扫码签到' : '其他'}
                              </div>
                              {reservation.checkinLatitude && reservation.checkinLongitude && (
                                <div className="text-gray-400">
                                  坐标: {Number(reservation.checkinLatitude).toFixed(4)}, {Number(reservation.checkinLongitude).toFixed(4)}
                                </div>
                              )}
                              {reservation.checkoutTime && (
                                <div className="text-blue-600">
                                  签退: {format(new Date(reservation.checkoutTime), "HH:mm")}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">未签到</span>
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

                {/* 分页 */}
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
          </TabsContent>

          {/* 课程排课审批Tab */}
          <TabsContent value="schedules">
            <div className="px-4 py-4">
              <div className="flex gap-2 items-center mb-4">
                <select className="border rounded px-2 py-1" value={labFilter ?? ''} onChange={(e) => { setLabFilter(e.target.value ? Number(e.target.value) : undefined); }}>
                  <option value="">全部实验室</option>
                  {labs?.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                </select>
              </div>

              {schedulesLoading ? (
                <div className="text-center py-12">加载中...</div>
              ) : pendingSchedules.length === 0 ? (
                <div className="text-center py-12 text-gray-500">暂无待审批的课程排课</div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>课程信息</TableHead>
                          <TableHead>教师</TableHead>
                          <TableHead>实验室</TableHead>
                          <TableHead>上课时间</TableHead>
                          <TableHead>周次范围</TableHead>
                          <TableHead>申请时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingSchedules.map((schedule: any) => (
                          <TableRow key={schedule.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{schedule.courseName}</div>
                                <div className="text-xs text-gray-500">{schedule.courseNo}</div>
                              </div>
                            </TableCell>
                            <TableCell>{schedule.teacherName || '-'}</TableCell>
                            <TableCell>{schedule.labName || '-'}</TableCell>
                            <TableCell>
                              <div className="font-medium">
                                {weekDayMap[schedule.dayOfWeek as number] || schedule.dayOfWeek}
                              </div>
                              <div className="text-xs text-gray-500">
                                第{schedule.startPeriod}-{schedule.endPeriod}节
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>第{schedule.startWeek}-{schedule.endWeek}周</div>
                              <div className="text-xs text-gray-500">{weekTypeMap[schedule.weekType as string] || schedule.weekType}</div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {format(new Date(schedule.createdAt), "yyyy-MM-dd HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveScheduleMutation.mutate({ id: schedule.id })}
                                  disabled={approveScheduleMutation.isPending}
                                >
                                  通过
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedId(schedule.id);
                                    setSelectedType('schedule');
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  拒绝
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
            </div>
          </TabsContent>

          {/* 课程预约审批Tab */}
          <TabsContent value="courseReservations">
            <div className="px-4 py-4">
              <div className="flex gap-2 items-center mb-4">
                <select className="border rounded px-2 py-1" value={labFilter ?? ''} onChange={(e) => { setLabFilter(e.target.value ? Number(e.target.value) : undefined); }}>
                  <option value="">全部实验室</option>
                  {labs?.map(l => (<option key={l.id} value={l.id}>{l.name}</option>))}
                </select>
              </div>

              {courseReservationsLoading ? (
                <div className="text-center py-12">加载中...</div>
              ) : pendingCourseReservations.length === 0 ? (
                <div className="text-center py-12 text-gray-500">暂无待审批的课程预约</div>
              ) : (
                <Card>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>课程信息</TableHead>
                          <TableHead>教师</TableHead>
                          <TableHead>实验室</TableHead>
                          <TableHead>预约标题</TableHead>
                          <TableHead>时间段</TableHead>
                          <TableHead>申请时间</TableHead>
                          <TableHead>操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {pendingCourseReservations.map((reservation: any) => (
                          <TableRow key={reservation.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{reservation.courseName || '-'}</div>
                                <div className="text-xs text-gray-500">{reservation.courseNo || '-'}</div>
                              </div>
                            </TableCell>
                            <TableCell>{reservation.teacherName || '-'}</TableCell>
                            <TableCell>{reservation.labName || '-'}</TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{reservation.title}</div>
                                {reservation.reason && (
                                  <div className="text-xs text-gray-500 mt-1">{reservation.reason}</div>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm">
                                <div>{format(new Date(reservation.startTime), "yyyy-MM-dd HH:mm")}</div>
                                <div className="text-gray-500">至 {format(new Date(reservation.endTime), "HH:mm")}</div>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm text-gray-500">
                              {format(new Date(reservation.createdAt), "yyyy-MM-dd HH:mm")}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => approveCourseReservationMutation.mutate({ id: reservation.id })}
                                  disabled={approveCourseReservationMutation.isPending}
                                >
                                  通过
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedId(reservation.id);
                                    setSelectedType('course');
                                    setRejectDialogOpen(true);
                                  }}
                                >
                                  拒绝
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
            </div>
          </TabsContent>
        </Tabs>
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
            <DialogTitle>{selectedType === 'schedule' ? '拒绝排课' : selectedType === 'course' ? '拒绝课程预约' : '拒绝预约'}</DialogTitle>
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
            <Button 
              onClick={handleReject} 
              disabled={rejectMutation.isPending || rejectScheduleMutation.isPending || rejectCourseReservationMutation.isPending}
            >
              {(rejectMutation.isPending || rejectScheduleMutation.isPending || rejectCourseReservationMutation.isPending) ? '提交中...' : '确认拒绝'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
