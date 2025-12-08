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

/**
 * 将 datetime-local 输入值转换为 Date 对象
 * datetime-local 返回格式: "2025-12-15T14:30" (没有时区信息)
 * 应按本地时间解析，不能直接用 new Date()（会按 UTC 解析）
 */
function parseLocalDateTimeInput(dateTimeStr: string): Date | null {
  if (!dateTimeStr) return null;
  
  // 格式应该是 "YYYY-MM-DDTHH:mm"
  const [datePart, timePart] = dateTimeStr.split("T");
  if (!datePart || !timePart) return null;
  
  const [year, month, day] = datePart.split("-").map(Number);
  const [hours, minutes] = timePart.split(":").map(Number);
  
  // 验证解析结果
  if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    return null;
  }
  
  // 构造本地时间 Date 对象
  // 注意：Date 的月份是 0-indexed
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  return date;
}

/**
 * 获取当前时间的 datetime-local 格式字符串
 * 用于设置输入框的最小值
 */
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

  const { checkReservation, errorMessage, isChecking, formatRuleDescription } = useReservationRules();

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

  // 验证时间的有效性和顺序
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

  // 当表单时间段改变时，实时检查规则
  useEffect(() => {
    if (!selectedLab) {
      setBasicValidationError(null);
      return;
    }

    // 先进行基本校验
    const timeValidation = validateTimes(reservationForm.startTime, reservationForm.endTime);
    setBasicValidationError(timeValidation.error);

    if (!timeValidation.valid) {
      return;
    }

    // 时间有效，执行规则预检查
    const startDate = parseLocalDateTimeInput(reservationForm.startTime)!;
    const endDate = parseLocalDateTimeInput(reservationForm.endTime)!;
    checkReservation(selectedLab, startDate, endDate);
  }, [selectedLab, reservationForm.startTime, reservationForm.endTime, checkReservation, validateTimes]);

  const handleSubmitReservation = () => {
    if (!selectedLab) return;
    
    // 基本校验
    const timeValidation = validateTimes(reservationForm.startTime, reservationForm.endTime);
    if (!timeValidation.valid) {
      toast.error(timeValidation.error || "请输入有效的时间");
      return;
    }
    
    // 规则检查
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
      {/* 主内容 */}
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
                  )}
                  <Button 
                    className="w-full mt-4" 
                    onClick={() => setSelectedLab(lab.id)}
                  >
                    预约
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      {/* 预约对话框 */}
      <Dialog open={selectedLab !== null} onOpenChange={(open) => !open && setSelectedLab(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>提交预约申请</DialogTitle>
            <DialogDescription>
              请填写预约信息，提交后等待管理员审核
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="title">预约标题</Label>
              <Input
                id="title"
                value={reservationForm.title}
                onChange={(e) => setReservationForm({ ...reservationForm, title: e.target.value })}
                placeholder="例如：数据结构课程实验"
              />
            </div>
            <div>
              <Label htmlFor="reason">预约事由</Label>
              <Textarea
                id="reason"
                value={reservationForm.reason}
                onChange={(e) => setReservationForm({ ...reservationForm, reason: e.target.value })}
                placeholder="请简要说明预约目的"
              />
            </div>
            <div>
              <Label htmlFor="peopleCount">预计人数</Label>
              <Input
                id="peopleCount"
                type="number"
                min={1}
                value={reservationForm.peopleCount}
                onChange={(e) => setReservationForm({ ...reservationForm, peopleCount: parseInt(e.target.value) })}
              />
            </div>
            <div>
              <Label htmlFor="startTime">开始时间 *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={reservationForm.startTime}
                min={getCurrentDateTimeLocal()}
                onChange={(e) => setReservationForm({ ...reservationForm, startTime: e.target.value })}
                className={basicValidationError ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500 mt-1">请选择今天及之后的时间</p>
            </div>
            <div>
              <Label htmlFor="endTime">结束时间 *</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={reservationForm.endTime}
                min={reservationForm.startTime || getCurrentDateTimeLocal()}
                onChange={(e) => setReservationForm({ ...reservationForm, endTime: e.target.value })}
                className={basicValidationError ? "border-red-500" : ""}
              />
              <p className="text-xs text-gray-500 mt-1">结束时间必须晚于开始时间</p>
            </div>

            {/* 预约规则提示 */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Clock className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-blue-800">
                  <p className="font-semibold mb-1">预约规则：</p>
                  {formatRuleDescription().length > 0 ? (
                    <ul className="space-y-1 list-disc list-inside">
                      {formatRuleDescription().map((desc, idx) => (
                        <li key={idx}>{desc}</li>
                      ))}
                    </ul>
                  ) : (
                    <p>无额外规则限制</p>
                  )}
                </div>
              </div>
            </div>

            {/* 基本校验错误 */}
            {basicValidationError && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">时间错误：</p>
                  <p>{basicValidationError}</p>
                </div>
              </div>
            )}

            {/* 规则检查错误 */}
            {!basicValidationError && errorMessage && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-red-800">
                  <p className="font-semibold">规则检查：</p>
                  <p>{errorMessage}</p>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedLab(null)}>
              取消
            </Button>
            <Button 
              onClick={handleSubmitReservation}
              disabled={
                createReservation.isPending || 
                isChecking || 
                !!basicValidationError || 
                !!errorMessage ||
                !reservationForm.title ||
                !reservationForm.startTime ||
                !reservationForm.endTime
              }
            >
              {createReservation.isPending ? "提交中..." : "提交申请"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
