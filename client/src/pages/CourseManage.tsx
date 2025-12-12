import { useMemo, useState } from "react";
import {
  Plus,
  Users,
  Trash2,
  Calendar,
  BookOpen,
  Clock,
  Search,
  GraduationCap,
  MapPin,
  School,
  History,
  AlertCircle,
} from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// 状态徽章
const StatusBadge = ({ status }: { status: string }) => {
  const styles = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    completed: "bg-slate-100 text-slate-700 border-slate-200",
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    approved: "bg-blue-100 text-blue-700 border-blue-200",
    rejected: "bg-rose-100 text-rose-700 border-rose-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  } as const;

  const labels = {
    active: "进行中",
    completed: "已结束",
    pending: "待审批",
    approved: "已批准",
    rejected: "已拒绝",
    cancelled: "已取消",
  } as const;

  const style = styles[status as keyof typeof styles] || styles.cancelled;
  const label = labels[status as keyof typeof labels] || status;

  return (
    <span className={cn("px-2.5 py-0.5 rounded-full text-xs font-medium border", style)}>
      {label}
    </span>
  );
};

export default function CourseManage() {
  const { isTeacher, isSysAdmin } = useRole();

  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditCourseDialogOpen, setIsEditCourseDialogOpen] = useState(false);
  const [isStudentDialogOpen, setIsStudentDialogOpen] = useState(false);
  const [isAddStudentDialogOpen, setIsAddStudentDialogOpen] = useState(false);
  const [isReservationDialogOpen, setIsReservationDialogOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [selectedStudentOpenIds, setSelectedStudentOpenIds] = useState<string[]>([]);
  const [studentSearchKeyword, setStudentSearchKeyword] = useState("");
  const [selectedClassFilter, setSelectedClassFilter] = useState<string>("all");
  const [deleteConfirm, setDeleteConfirm] = useState<{
    type: "student" | "reservation";
    courseId?: number;
    id: number;
    name: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    semester: "",
  });

  const [editFormData, setEditFormData] = useState({
    name: "",
    description: "",
    semester: "",
  });

  const [reservationData, setReservationData] = useState({
    labId: "",
    title: "",
    reason: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  const [editingReservation, setEditingReservation] = useState<any>(null);
  const [editReservationData, setEditReservationData] = useState({
    labId: "",
    title: "",
    reason: "",
    date: "",
    startTime: "",
    endTime: "",
  });

  // 生成学期选项（过去2年到未来2年）
  const semesterOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    const currentYear = new Date().getFullYear();
    for (let year = currentYear - 2; year <= currentYear + 2; year++) {
      for (let semester = 1; semester <= 2; semester++) {
        const label = `${year} 学年 第${semester}学期`;
        const value = `${year}-${semester}`;
        options.push({ label, value });
      }
    }
    return options.reverse();
  }, []);

  // 权限检查
  if (!isTeacher && !isSysAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="bg-red-50 p-6 rounded-full">
          <AlertCircle className="h-12 w-12 text-red-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900">权限不足</h1>
          <p className="text-slate-500 mt-2">你没有权限访问课程管理模块</p>
        </div>
      </div>
    );
  }

  // 数据查询
  const { data: courses = [], isLoading, refetch } = trpc.course.list.useQuery();
  const { data: allUsers = [] } = trpc.user.getAll.useQuery();
  const { data: allClasses = [] } = trpc.class.list.useQuery();
  const { data: labs = [] } = trpc.courseReservation.listLabs.useQuery();
  const { data: students = [] } = trpc.course.getStudents.useQuery(
    { courseId: selectedCourse?.id || 0 },
    { enabled: !!selectedCourse }
  );
  const { data: courseReservations = [], refetch: refetchCourseReservations } = trpc.courseReservation.getAllByCourse.useQuery(
    { courseId: selectedCourse?.id || 0 },
    { enabled: !!selectedCourse }
  );
  const { data: classStudents = [] } = trpc.class.getStudents.useQuery(
    { classId: parseInt(selectedClassFilter) || 0 },
    { enabled: selectedClassFilter !== "all" && !!selectedClassFilter }
  );

  // 过滤学生
  const allStudents = useMemo(
    () => allUsers.filter((u: any) => u.role === "student"),
    [allUsers]
  );

  const filteredStudents = useMemo(() => {
    let list = allStudents;
    if (selectedClassFilter !== "all") {
      const classIds = new Set(classStudents.map((cs: any) => cs.studentId));
      list = list.filter((s: any) => classIds.has(s.id));
    }
    if (studentSearchKeyword) {
      list = list.filter(
        (s: any) =>
          s.name?.toLowerCase().includes(studentSearchKeyword.toLowerCase()) ||
          s.openId?.toLowerCase().includes(studentSearchKeyword.toLowerCase())
      );
    }
    return list;
  }, [allStudents, classStudents, selectedClassFilter, studentSearchKeyword]);

  const selectedSet = useMemo(() => new Set(selectedStudentOpenIds), [selectedStudentOpenIds]);
  const displayedStudentOpenIds = useMemo(
    () => filteredStudents.map((s: any) => s.openId),
    [filteredStudents]
  );

  // Mutations
  const createCourseMutation = trpc.course.create.useMutation({
    onSuccess: () => {
      toast.success("课程创建成功");
      setFormData({ name: "", description: "", semester: "" });
      setIsCreateDialogOpen(false);
      refetch();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const addStudentMutation = trpc.course.addStudent.useMutation({
    onSuccess: (result) => {
      toast.success(`成功添加 ${result.addedCount} 名学生`);
      setSelectedStudentOpenIds([]);
      setStudentSearchKeyword("");
      setIsAddStudentDialogOpen(false);
      refetch();
    },
    onError: (error) => toast.error(`添加失败: ${error.message}`),
  });

  const removeStudentMutation = trpc.course.removeStudent.useMutation({
    onSuccess: () => {
      toast.success("学生已成功移除");
      setDeleteConfirm(null);
      refetch();
    },
    onError: (error) => toast.error(`移除失败: ${error.message}`),
  });

  // const updateCourseMutation = trpc.course.update.useMutation({
  //   onSuccess: () => {
  //     toast.success("课程已成功更新");
  //     setIsEditCourseDialogOpen(false);
  //     refetch();
  //   },
  //   onError: (error) => toast.error(`更新失败: ${error.message}`),
  // });

  const deleteLabRoomMutation = trpc.labRoom.delete.useMutation({
    onSuccess: async () => {
      toast.success("实验室已成功删除");
      setDeleteConfirm(null);
      await refetchCourseReservations();
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const reserveLabMutation = trpc.courseReservation.create.useMutation({
    onSuccess: async () => {
      toast.success("实验室预约成功");
      setReservationData({ labId: "", title: "", reason: "", date: "", startTime: "", endTime: "" });
      // 立即刷新课程预约列表
      await refetchCourseReservations();
    },
    onError: (error) => toast.error(`预约失败: ${error.message}`),
  });

  // const updateReservationMutation = trpc.courseReservation.update.useMutation({
  //   onSuccess: async () => {
  //     toast.success("预约已成功更新");
  //     setEditingReservation(null);
  //     await refetchCourseReservations();
  //   },
  //   onError: (error: any) => toast.error(`更新失败: ${error.message}`),
  // });

  const cancelReservationMutation = trpc.courseReservation.cancel.useMutation({
    onSuccess: async () => {
      toast.success("预约已取消");
      setDeleteConfirm(null);
      // 立即刷新课程预约列表
      await refetchCourseReservations();
    },
    onError: (error) => toast.error(`取消失败: ${error.message}`),
  });

  // 处理函数
  const handleCreateCourse = () => {
    if (!formData.name || !formData.semester) {
      toast.error("请填写必填字段");
      return;
    }
    createCourseMutation.mutate({
      courseNo: formData.name, // 使用课程名作为课程号
      name: formData.name,
      description: formData.description?.trim() || "",
      semester: formData.semester,
    });
  };

  const handleAddStudents = () => {
    if (!selectedCourse) {
      toast.error("请先选择课程");
      return;
    }
    if (selectedStudentOpenIds.length === 0) {
      toast.error("请选择至少一名学生");
      return;
    }
    addStudentMutation.mutate({
      courseId: selectedCourse.id,
      studentOpenIds: selectedStudentOpenIds,
    });
  };

  const handleEditCourse = () => {
    if (!selectedCourse) {
      toast.error("请先选择课程");
      return;
    }
    if (!editFormData.name || !editFormData.semester) {
      toast.error("请填写必填字段");
      return;
    }
    toast.error("暂不支持课程更新功能");
    // TODO: 实现课程更新功能
    // updateCourseMutation.mutate({
    //   courseId: selectedCourse.id,
    //   name: editFormData.name,
    //   description: editFormData.description || null,
    //   semester: editFormData.semester,
    // });
  };

  const handleEditReservation = (reservation: any) => {
    const startDateTime = new Date(reservation.startTime);
    const endDateTime = new Date(reservation.endTime);
    const dateStr = startDateTime.toISOString().split('T')[0];
    const startTimeStr = startDateTime.toTimeString().slice(0, 5);
    const endTimeStr = endDateTime.toTimeString().slice(0, 5);

    setEditingReservation(reservation);
    setEditReservationData({
      labId: reservation.labId.toString(),
      title: reservation.title,
      reason: reservation.reason || "",
      date: dateStr,
      startTime: startTimeStr,
      endTime: endTimeStr,
    });
  };

  const handleUpdateReservation = () => {
    if (!editReservationData.labId || !editReservationData.title || !editReservationData.date || !editReservationData.startTime || !editReservationData.endTime) {
      toast.error("请填写所有必填字段");
      return;
    }
    const startDateTime = new Date(`${editReservationData.date}T${editReservationData.startTime}:00`);
    const endDateTime = new Date(`${editReservationData.date}T${editReservationData.endTime}:00`);
    if (startDateTime >= endDateTime) {
      toast.error("开始时间必须早于结束时间");
      return;
    }
    toast.error("暂不支持预约更新功能");
    // TODO: 实现预约更新功能
    // updateReservationMutation.mutate({
    //   reservationId: editingReservation.id,
    //   labId: parseInt(editReservationData.labId),
    //   title: editReservationData.title,
    //   reason: editReservationData.reason || undefined,
    //   startTime: startDateTime,
    //   endTime: endDateTime,
    // });
  };

  const handleReserveLab = () => {
    if (!selectedCourse) {
      toast.error("请先选择课程");
      return;
    }
    const { labId, title, date, startTime, endTime } = reservationData;
    if (!labId || !title || !date || !startTime || !endTime) {
      toast.error("请填写所有必填字段");
      return;
    }
    const startDateTime = new Date(`${date}T${startTime}:00`);
    const endDateTime = new Date(`${date}T${endTime}:00`);
    if (startDateTime >= endDateTime) {
      toast.error("开始时间必须早于结束时间");
      return;
    }
    reserveLabMutation.mutate({
      courseId: selectedCourse.id,
      labId: parseInt(labId),
      title,
      reason: reservationData.reason || undefined,
      startTime: startDateTime,
      endTime: endDateTime,
    });
  };

  const toggleStudent = (openId: string) => {
    setSelectedStudentOpenIds((prev) =>
      prev.includes(openId) ? prev.filter((id) => id !== openId) : [...prev, openId]
    );
  };

  const handleSelectAll = () => {
    if (selectedStudentOpenIds.length === displayedStudentOpenIds.length) {
      setSelectedStudentOpenIds([]);
    } else {
      setSelectedStudentOpenIds(displayedStudentOpenIds);
    }
  };

  return (
    <div className="space-y-8 p-1">
      {/* 顶部标题区 */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b pb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-indigo-500" /> 课程管理
          </h1>
          <p className="text-slate-500 mt-2 flex items-center gap-2">
            <Calendar className="h-4 w-4" /> 管理课程、学生名单及实验室预约
          </p>
        </div>
        <Button
          onClick={() => setIsCreateDialogOpen(true)}
          className="bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all hover:shadow-md"
        >
          <Plus className="mr-2 h-4 w-4" /> 新建课程
        </Button>
      </div>

      {/* 课程列表 */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="flex flex-col itemscenter justify-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <div className="bg-white p-4 rounded-full shadow-sm mb-4">
            <School className="h-10 w-10 text-indigo-400" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900">暂无课程</h3>
          <p className="text-slate-500 mt-1 max-w-sm text-center">
            当前学期没有正在进行的课程。点击右上角的按钮创建一个新课程。
          </p>
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course: any) => (
            <Card
              key={course.id}
              className={cn(
                "group flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 overflow-hidden border-t-4",
                course.status === "active" ? "border-t-indigo-500" : "border-t-slate-400"
              )}
            >
              <CardHeader className="pb-3 bg-gradient-to-b from-slate-50/50 to-transparent">
                <div className="flex justify-between items-start mb-1">
                  <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                    {course.courseNo}
                  </span>
                  <StatusBadge status={course.status} />
                </div>
                <CardTitle className="text-lg font-bold text-slate-800 line-clamp-1" title={course.name}>
                  {course.name}
                </CardTitle>
                <CardDescription className="line-clamp-2 min-h-[2.5em] text-xs mt-1">
                  {course.description || "暂无描述"}
                </CardDescription>
              </CardHeader>

              <CardContent className="flex-1 py-4">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <Users className="h-4 w-4 text-indigo-500" />
                    <div>
                      <p className="font-semibold">{course.studentCount || 0}</p>
                      <p className="text-xs text-slate-400">学生</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 text-slate-600 bg-slate-50 p-2 rounded-lg">
                    <GraduationCap className="h-4 w-4 text-emerald-500" />
                    <span className="font-semibold truncate">{course.teacherName || "-"}</span>
                  </div>
                  <div className="col-span-2 flex items-center gap-2 text-xs text-slate-500 px-1">
                    <Calendar className="h-3 w-3" />
                    <span>{course.semester} 学期</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="pt-0 pb-3 px-4 grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 border-slate-200"
                  onClick={() => {
                    setSelectedCourse(course);
                    setIsStudentDialogOpen(true);
                  }}
                >
                  管理学生
                </Button>
                <Button
                  size="sm"
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  onClick={() => {
                    setSelectedCourse(course);
                    setReservationData({ labId: "", title: "", reason: "", date: "", startTime: "", endTime: "" });
                    setIsReservationDialogOpen(true);
                  }}
                >
                  预约实验
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedCourse(course);
                    setEditFormData({
                      name: course.name,
                      description: course.description || "",
                      semester: course.semester,
                    });
                    setIsEditCourseDialogOpen(true);
                  }}
                >
                  修改课程
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setSelectedCourse(course);
                    setSelectedStudentOpenIds([]);
                    setStudentSearchKeyword("");
                    setIsAddStudentDialogOpen(true);
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> 添加学生
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* 1. 新建课程 */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">新建课程</DialogTitle>
            <DialogDescription>填写课程基本信息以创建新课程。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>学期 <span className="text-red-500">*</span></Label>
              <Select value={formData.semester} onValueChange={(v) => setFormData({ ...formData, semester: v })}>
                <SelectTrigger><SelectValue placeholder="选择学期" /></SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>课程名称 <span className="text-red-500">*</span></Label>
              <Input placeholder="如: 高级数据结构" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input placeholder="简短的课程描述..." value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>取消</Button>
            <Button onClick={handleCreateCourse} disabled={createCourseMutation.isPending} className="bg-indigo-600 hover:bg-indigo-700">
              {createCourseMutation.isPending ? "创建中..." : "确认创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 1.5. 修改课程 */}
      <Dialog open={isEditCourseDialogOpen} onOpenChange={setIsEditCourseDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-xl">修改课程</DialogTitle>
            <DialogDescription>更新课程的基本信息。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>学期 <span className="text-red-500">*</span></Label>
              <Select value={editFormData.semester} onValueChange={(v) => setEditFormData({ ...editFormData, semester: v })}>
                <SelectTrigger><SelectValue placeholder="选择学期" /></SelectTrigger>
                <SelectContent>
                  {semesterOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>课程名称 <span className="text-red-500">*</span></Label>
              <Input placeholder="如: 高级数据结构" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>描述</Label>
              <Input placeholder="简短的课程描述..." value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsEditCourseDialogOpen(false)}>取消</Button>
            <Button disabled className="bg-indigo-600 hover:bg-indigo-700">
              {"确认修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 2. 查看学生列表 */}
      <Dialog open={isStudentDialogOpen} onOpenChange={setIsStudentDialogOpen}>
        <DialogContent className="max-w-3xl rounded-xl">
          <DialogHeader className="border-b pb-4">
            <div className="flex items-center justify-between mr-8">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-500" />
                  {selectedCourse?.name}
                </DialogTitle>
                <DialogDescription className="mt-1">
                  当前共有 <span className="font-semibold text-indigo-600">{students.length}</span> 名学生
                </DialogDescription>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-2 border-dashed"
                onClick={() => {
                  setIsStudentDialogOpen(false);
                  setIsAddStudentDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> 添加学生
              </Button>
            </div>
          </DialogHeader>

          <div className="h-[400px] overflow-y-auto pr-2 -mr-2">
            {students.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Users className="h-12 w-12 mb-3 opacity-20" />
                <p>暂无学生名单</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 p-1">
                {students.map((student: any, index: number) => (
                  <div key={student.id} className="group flex items-center justify-between p-3 rounded-lg border bg-white hover:border-indigo-200 hover:shadow-sm transition-all">
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400 font-mono">#{index + 1}</span>
                      <div>
                        <p className="font-medium text-slate-900">{student.studentName || `学生${student.studentId}`}</p>
                        <p className="text-xs text-slate-500">OpenID: {student.studentOpenId || "-"}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-100 hover:text-red-700"
                      onClick={() =>
                        setDeleteConfirm({
                          type: "student",
                          courseId: selectedCourse.id,
                          id: student.studentId,
                          name: student.studentName || `学生${student.studentId}`,
                        })
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 3. 添加学生 */}
      <Dialog open={isAddStudentDialogOpen} onOpenChange={setIsAddStudentDialogOpen}>
        <DialogContent className="max-w-4xl rounded-xl p-0 overflow-hidden flex flex-col md:flex-row h-[600px]">
          {/* 左侧：过滤器 */}
          <div className="w-full md:w-1/3 bg-slate-50 p-6 border-r flex flex-col gap-6">
            <div>
              <DialogTitle className="text-lg mb-1">添加学生</DialogTitle>
              <DialogDescription>从系统用户库中选择学生添加到课程。</DialogDescription>
            </div>

            <div className="space-y-4 flex-1">
              <div className="space-y-2">
                <Label>按班级筛选</Label>
                <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                  <SelectTrigger className="bg-white"><SelectValue placeholder="全部班级" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部班级</SelectItem>
                    {allClasses.map((cls: any) => (
                      <SelectItem key={cls.id} value={cls.id.toString()}>
                        {cls.name} ({cls.classNo})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>搜索</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    className="pl-9"
                    placeholder="搜索学生姓名或 OpenID"
                    value={studentSearchKeyword}
                    onChange={(e) => setStudentSearchKeyword(e.target.value)}
                  />
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex justify-between items-center text-sm text-slate-600 mb-2">
                  <span>已选: {selectedStudentOpenIds.length} 人</span>
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    {selectedStudentOpenIds.length === displayedStudentOpenIds.length && displayedStudentOpenIds.length > 0
                      ? "取消全选"
                      : "全选"}
                  </Button>
                </div>
                <Button
                  className="w-full"
                  disabled={selectedStudentOpenIds.length === 0 || addStudentMutation.isPending}
                  onClick={handleAddStudents}
                >
                  {addStudentMutation.isPending ? "处理中..." : "确认添加"}
                </Button>
              </div>
            </div>

            <Button
              onClick={handleAddStudents}
              disabled={addStudentMutation.isPending || selectedStudentOpenIds.length === 0}
              className="w-full bg-indigo-600 hover:bg-indigo-700"
            >
              {addStudentMutation.isPending ? "处理中..." : "确认添加"}
            </Button>
          </div>

          {/* 右侧：列表 */}
          <div className="flex-1 p-6 overflow-y-auto bg-white">
            {filteredStudents.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-400">
                <Search className="h-10 w-10 mb-2 opacity-20" />
                <p>未找到匹配的学生</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {filteredStudents.map((student: any) => {
                  const isSelected = selectedSet.has(student.openId);
                  return (
                    <button
                      key={student.id}
                      onClick={() => toggleStudent(student.openId)}
                      className={cn(
                        "w-full flex items-center gap-3 p-3 rounded-lg border text-left",
                        isSelected ? "border-indigo-300 bg-indigo-50" : "hover:bg-slate-50"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {}}
                        className="w-4 h-4 cursor-pointer"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{student.name || "未命名"}</p>
                        <p className="text-xs text-slate-500">{student.openId}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* 4. 实验室预约 */}
      <Dialog open={isReservationDialogOpen} onOpenChange={setIsReservationDialogOpen}>
        <DialogContent className="w-[95vw] max-w-[95vw] rounded-xl p-0 overflow-hidden h-[95vh] flex flex-col">
          <div className="p-8 border-b bg-slate-50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <DialogTitle className="text-2xl text-slate-900">实验室预约</DialogTitle>
              <DialogDescription className="text-slate-600 text-base">
                当前课程: <span className="font-semibold text-indigo-600">{selectedCourse?.name}</span>
              </DialogDescription>
            </div>
            <div className="bg-white px-4 py-2 rounded-full border text-sm text-slate-600 flex items-center gap-2 whitespace-nowrap">
              <History className="h-4 w-4" />
              历史记录: {courseReservations.length} 条
            </div>
          </div>

          <div className="flex flex-col lg:flex-row flex-1 overflow-hidden">
            {/* 左侧：表单 */}
            <div className="w-full lg:w-[50%] p-6 overflow-y-auto border-r border-b lg:border-b-0 bg-white">
              <h3 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
                <Plus className="h-4 w-4 bg-slate-100 rounded p-0.5" />
                新建预约申请
              </h3>
              <div className="space-y-4">
                <div>
                  <Label className="text-sm">选择实验室</Label>
                  <Select value={reservationData.labId} onValueChange={(v) => setReservationData({ ...reservationData, labId: v })}>
                    <SelectTrigger className="mt-1.5 h-9 text-sm"><SelectValue placeholder="选择实验室" /></SelectTrigger>
                    <SelectContent>
                      {labs.map((lab: any) => (
                        <SelectItem key={lab.id} value={lab.id.toString()}>
                          {lab.name} (容纳 {lab.capacity} 人)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {reservationData.labId && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                    <p className="text-blue-800 font-semibold mb-2">已选实验室</p>
                    <p className="text-blue-700 font-medium text-sm">{labs.find(l => l.id.toString() === reservationData.labId)?.name}</p>
                  </div>
                )}
                <div>
                  <Label className="text-sm">标题</Label>
                  <Input className="mt-1.5 h-8 text-sm" placeholder="实验课名称" value={reservationData.title} onChange={(e) => setReservationData({ ...reservationData, title: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm">日期</Label>
                  <Input className="mt-1.5 h-8 text-sm" type="date" value={reservationData.date} onChange={(e) => setReservationData({ ...reservationData, date: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm">开始时间</Label>
                  <Input className="mt-1.5 h-8 text-sm w-full" type="time" value={reservationData.startTime} onChange={(e) => setReservationData({ ...reservationData, startTime: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm">结束时间</Label>
                  <Input className="mt-1.5 h-8 text-sm w-full" type="time" value={reservationData.endTime} onChange={(e) => setReservationData({ ...reservationData, endTime: e.target.value })} />
                </div>
                <div>
                  <Label className="text-sm">备注原因 (可选)</Label>
                  <Input className="mt-1.5 h-8 text-sm" placeholder="特殊说明..." value={reservationData.reason} onChange={(e) => setReservationData({ ...reservationData, reason: e.target.value })} />
                </div>
                <Button onClick={handleReserveLab} disabled={reserveLabMutation.isPending} className="w-full mt-4 h-9 text-sm bg-indigo-600 hover:bg-indigo-700">
                  {reserveLabMutation.isPending ? "提交中..." : "提交申请"}
                </Button>
              </div>
            </div>

            {/* 右侧：列表 */}
            <div className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
              <h3 className="font-bold text-base text-slate-800 mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 bg-slate-200 rounded p-0.5" />
                预约记录
              </h3>
              {courseReservations.length === 0 ? (
                <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-lg text-sm">
                  <p>暂无预约记录</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {courseReservations.map((reservation: any) => {
                    const startTime = new Date(reservation.startTime).toLocaleString("zh-CN", {
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    });
                    const endTime = new Date(reservation.endTime).toLocaleTimeString("zh-CN", {
                      hour: "2-digit",
                      minute: "2-digit",
                    });

                    const status = reservation.status as "pending" | "approved" | "rejected" | "cancelled" | "completed";
                    const statusColor = {
                      pending: "bg-yellow-100 text-yellow-800",
                      approved: "bg-green-100 text-green-800",
                      rejected: "bg-red-100 text-red-800",
                      cancelled: "bg-gray-100 text-gray-800",
                      completed: "bg-blue-100 text-blue-800",
                    }[status] || "bg-gray-100";

                    const statusText = {
                      pending: "待审批",
                      approved: "已批准",
                      rejected: "已拒绝",
                      cancelled: "已取消",
                      completed: "已完成",
                    }[status] || "未知";

                    return (
                      <div key={reservation.id} className="border rounded p-3 text-xs bg-gray-50 hover:bg-gray-100 transition-colors">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <p className="font-medium text-slate-800 text-sm">{reservation.title}</p>
                            {reservation.labRoom && (
                              <p className="text-xs text-blue-600 mt-1">
                                📍 {reservation.labRoom.name}
                                {reservation.labRoom.location && ` - ${reservation.labRoom.location}`}
                              </p>
                            )}
                            <p className="text-xs text-gray-600 mt-1">{startTime} - {endTime}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor} ml-2 flex-shrink-0`}>
                            {statusText}
                          </span>
                        </div>
                        {status === "pending" && (
                          <div className="flex gap-1 mt-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-indigo-600 hover:bg-indigo-100 hover:text-indigo-700 text-xs h-7 font-medium"
                              onClick={() => handleEditReservation(reservation)}
                            >
                              修改
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="flex-1 text-red-600 hover:bg-red-100 hover:text-red-700 text-xs h-7 font-medium"
                              onClick={() =>
                                setDeleteConfirm({
                                  type: "reservation",
                                  courseId: selectedCourse.id,
                                  id: reservation.id,
                                  name: `${reservation.title} 的预约`,
                                })
                              }
                            >
                              取消
                            </Button>
                          </div>
                        )}
                        {status === "approved" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="w-full text-red-600 hover:bg-red-100 hover:text-red-700 text-xs h-7 font-medium mt-2"
                            onClick={() =>
                              setDeleteConfirm({
                                type: "reservation",
                                courseId: selectedCourse.id,
                                id: reservation.id,
                                name: `${reservation.title} 的预约`,
                              })
                            }
                          >
                            取消预约
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 编辑预约 */}
      <Dialog open={!!editingReservation} onOpenChange={(open) => !open && setEditingReservation(null)}>
        <DialogContent className="max-w-md rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg">修改预约</DialogTitle>
            <DialogDescription>更新预约的基本信息（仅待审批状态可修改）</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-4">
            <div className="space-y-1.5">
              <Label className="text-sm">选择实验室</Label>
              <Select value={editReservationData.labId} onValueChange={(v) => setEditReservationData({ ...editReservationData, labId: v })}>
                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="选择实验室" /></SelectTrigger>
                <SelectContent>
                  {labs.map((lab: any) => (
                    <SelectItem key={lab.id} value={lab.id.toString()}>
                      {lab.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">标题</Label>
              <Input className="h-8 text-sm" placeholder="预约标题" value={editReservationData.title} onChange={(e) => setEditReservationData({ ...editReservationData, title: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">日期</Label>
              <Input className="h-8 text-sm" type="date" value={editReservationData.date} onChange={(e) => setEditReservationData({ ...editReservationData, date: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-sm">开始时间</Label>
                <Input className="h-8 text-sm" type="time" value={editReservationData.startTime} onChange={(e) => setEditReservationData({ ...editReservationData, startTime: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm">结束时间</Label>
                <Input className="h-8 text-sm" type="time" value={editReservationData.endTime} onChange={(e) => setEditReservationData({ ...editReservationData, endTime: e.target.value })} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">备注</Label>
              <Input className="h-8 text-sm" placeholder="可选" value={editReservationData.reason} onChange={(e) => setEditReservationData({ ...editReservationData, reason: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setEditingReservation(null)}>取消</Button>
            <Button size="sm" disabled className="bg-indigo-600 hover:bg-indigo-700">
              {"保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 确认删除/取消 */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent className="rounded-xl">
          <AlertDialogHeader>
            <div className="mx-auto bg-red-100 h-12 w-12 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <AlertDialogTitle className="text-center">
              {deleteConfirm?.type === "student" 
                ? "移除学生" 
                : "取消预约"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-center">
              {deleteConfirm?.type === "student"
                ? `确定要将 "${deleteConfirm?.name}" 从课程中移除吗？此操作不可撤销。`
                : `确定要取消 "${deleteConfirm?.name}" 的预约申请吗？`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="sm:justify-center">
            <AlertDialogCancel>再想想</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (!deleteConfirm) return;
                if (deleteConfirm.type === "student") {
                  removeStudentMutation.mutate({
                    courseId: deleteConfirm.courseId!,
                    studentId: deleteConfirm.id,
                  });
                } else {
                  cancelReservationMutation.mutate({
                    reservationId: deleteConfirm.id,
                  });
                }
              }}
              disabled={removeStudentMutation.isPending || cancelReservationMutation.isPending}
            >
              {removeStudentMutation.isPending || cancelReservationMutation.isPending 
                ? "处理中..." 
                : `确认${deleteConfirm?.type === "student" ? "移除" : "取消"}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
