import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookOpen, Clock, MapPin, Users, ChevronRight } from "lucide-react";
import { useState } from "react";

export default function StudentCourses() {
  const { user } = useAuth();
  const [selectedCourse, setSelectedCourse] = useState<any>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);

  // 检查是否是学生
  if (user?.role !== 'student') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600">权限不足</h1>
          <p className="text-gray-600 mt-2">只有学生可以查看此页面</p>
        </div>
      </div>
    );
  }

  // 查询学生的课程列表
  const { data: courses = [], isLoading, error } = trpc.course.list.useQuery();

  // 查询课程预约（实验室时间）
  const { data: courseReservations = {} } = trpc.courseReservation.getByCourse.useQuery(
    { courseId: selectedCourse?.id || 0 },
    { enabled: !!selectedCourse }
  );

  const handleViewDetails = (course: any) => {
    setSelectedCourse(course);
    setIsDetailDialogOpen(true);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '-';
    try {
      const date = new Date(dateString);
      return date.toLocaleString('zh-CN');
    } catch {
      return dateString;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">我的课程</h1>
        <div className="text-sm text-gray-500">
          共选修 {courses.length} 门课程
        </div>
      </div>

      {isLoading ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-gray-500 text-center py-8">加载课程中...</p>
          </CardContent>
        </Card>
      ) : error ? (
        <Card>
          <CardContent className="pt-6">
            <p className="text-red-500 text-center py-8">
              加载失败：{error.message}
            </p>
          </CardContent>
        </Card>
      ) : courses.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <BookOpen className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">暂无选修课程</p>
              <p className="text-sm text-gray-400 mt-1">请联系教师进行课程选择</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course: any) => (
            <Card 
              key={course.id} 
              className="hover:shadow-lg transition-shadow cursor-pointer"
              onClick={() => handleViewDetails(course)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{course.name}</CardTitle>
                <p className="text-sm text-gray-500">{course.courseNo}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Users className="h-4 w-4" />
                  <span>教师：{course.teacherName || '-'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock className="h-4 w-4" />
                  <span>学期：{course.semester || '-'}</span>
                </div>
                <div className="pt-2">
                  <Button 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewDetails(course);
                    }}
                  >
                    查看详情
                    <ChevronRight className="h-3 w-3 ml-1" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* 课程详情对话框 */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedCourse?.name}</DialogTitle>
            <DialogDescription>
              课程编号：{selectedCourse?.courseNo}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">教师</p>
                <p className="font-medium">{selectedCourse?.teacherName || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">学期</p>
                <p className="font-medium">{selectedCourse?.semester || '-'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">状态</p>
                <p className="font-medium capitalize">
                  {selectedCourse?.status === 'active' ? '活跃' : '已归档'}
                </p>
              </div>
            </div>

            {/* 实验室预约时间 */}
            <div className="border-t pt-4">
              <h3 className="font-semibold mb-3">实验室预约</h3>
              {Array.isArray(courseReservations) && courseReservations.length > 0 ? (
                <div className="space-y-2">
                  {courseReservations.map((reservation: any) => (
                    <div key={reservation.id} className="flex items-start gap-3 p-3 bg-blue-50 rounded-lg">
                      <MapPin className="h-4 w-4 text-blue-600 mt-1 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="font-medium text-sm">{reservation.title}</p>
                        {reservation.labRoom && (
                          <p className="text-xs text-blue-700 mt-1">
                            <MapPin className="h-3.5 w-3.5 text-blue-700 inline-block mr-1 -mt-0.5" />
                            {reservation.labRoom.name}
                            {reservation.labRoom.location && ` - ${reservation.labRoom.location}`}
                          </p>
                        )}
                        <p className="text-xs text-gray-600 mt-1">
                          {formatDateTime(reservation.startTime)} 至 {formatDateTime(reservation.endTime)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          状态：<span className="capitalize">{reservation.status}</span>
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">暂无实验室预约</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
