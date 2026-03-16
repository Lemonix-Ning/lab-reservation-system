import { useState, useEffect, type FormEvent } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { UserPlus, Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

const roleLabels: Record<string, string> = {
  student: '学生',
  teacher: '教师',
  labAdmin: '实验室管理员',
  sysAdmin: '系统管理员',
};

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待审核', color: 'bg-yellow-100 text-yellow-800', icon: Clock },
  approved: { label: '已通过', color: 'bg-green-100 text-green-800', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-800', icon: XCircle },
};

export default function RoleUpgradeRequest() {
  const { user, refresh: refreshUser } = useAuth();
  const [formData, setFormData] = useState({
    requestedRole: '' as 'teacher' | 'labAdmin' | '',
    reason: '',
    department: '',
    employeeNo: '',
  });

  const { data: myRequests = [], isLoading, refetch } = trpc.roleRequest.myRequests.useQuery();
  
  // 检查是否有刚通过的申请，如果有则刷新用户信息
  useEffect(() => {
    const hasApprovedRequest = myRequests.some(
      r => r.status === 'approved' && r.requestedRole !== user?.role
    );
    
    if (hasApprovedRequest) {
      // 有已通过但角色未更新的申请，刷新用户信息
      refreshUser();
    }
  }, [myRequests, user?.role, refreshUser]);
  
  const createMutation = trpc.roleRequest.create.useMutation({
    onSuccess: () => {
      toast.success('申请已提交，请等待管理员审核');
      refetch();
      setFormData({ requestedRole: '', reason: '', department: '', employeeNo: '' });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.requestedRole) {
      toast.error('请选择申请角色');
      return;
    }
    if (formData.reason.length < 10) {
      toast.error('申请理由至少10个字');
      return;
    }
    createMutation.mutate({
      requestedRole: formData.requestedRole,
      reason: formData.reason,
      department: formData.department || undefined,
      employeeNo: formData.employeeNo || undefined,
    });
  };

  const hasPendingRequest = myRequests.some(r => r.status === 'pending');

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="container py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <UserPlus className="h-8 w-8 text-indigo-600" />
              <h2 className="text-3xl font-bold text-gray-900">身份升级申请</h2>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                refreshUser();
                refetch();
                toast.success('已刷新');
              }}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新状态
            </Button>
          </div>
          <p className="text-gray-600">
            当前身份：<Badge variant="outline">{roleLabels[user?.role || 'student']}</Badge>
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 申请表单 */}
          <Card>
            <CardHeader>
              <CardTitle>提交申请</CardTitle>
              <CardDescription>
                填写以下信息申请成为教师或实验室管理员。提交后将由系统管理员审核。
              </CardDescription>
            </CardHeader>
            <CardContent>
              {user?.role === 'sysAdmin' ? (
                <div className="flex items-center gap-2 text-green-600 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>您已是系统管理员，拥有最高权限</span>
                </div>
              ) : user?.role === 'labAdmin' ? (
                <div className="flex items-center gap-2 text-blue-600 p-4 bg-blue-50 rounded-lg">
                  <CheckCircle className="h-5 w-5" />
                  <span>您已是实验室管理员，如需更高权限请联系系统管理员</span>
                </div>
              ) : hasPendingRequest ? (
                <div className="flex items-center gap-2 text-yellow-600 p-4 bg-yellow-50 rounded-lg">
                  <Clock className="h-5 w-5" />
                  <span>您有待审核的申请，请等待管理员处理</span>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>申请角色 *</Label>
                    <Select 
                      value={formData.requestedRole} 
                      onValueChange={(v) => setFormData(prev => ({ ...prev, requestedRole: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="请选择要申请的角色" />
                      </SelectTrigger>
                      <SelectContent>
                        {user?.role === 'student' && (
                          <SelectItem value="teacher">教师</SelectItem>
                        )}
                        {user?.role === 'teacher' && (
                          <SelectItem value="labAdmin">实验室管理员</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {user?.role === 'student' && (
                      <p className="text-xs text-muted-foreground">
                        💡 学生需要先申请成为教师，才能申请实验室管理员
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>所属院系/部门</Label>
                    <Input
                      placeholder="如：计算机科学与技术学院"
                      value={formData.department}
                      onChange={(e) => setFormData(prev => ({ ...prev, department: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>工号</Label>
                    <Input
                      placeholder="如：T2024001"
                      value={formData.employeeNo}
                      onChange={(e) => setFormData(prev => ({ ...prev, employeeNo: e.target.value }))}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>申请理由 *</Label>
                    <Textarea
                      placeholder="请详细说明申请原因，至少10个字..."
                      rows={4}
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                    />
                    <p className="text-xs text-gray-500">
                      {formData.reason.length}/10 字（最少10字）
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50 rounded-lg text-sm text-blue-700">
                    <AlertCircle className="h-4 w-4 inline mr-1" />
                    提交后将由系统管理员审核，请确保信息真实有效。
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full"
                    disabled={createMutation.isPending || !formData.requestedRole || formData.reason.length < 10}
                  >
                    {createMutation.isPending ? '提交中...' : '提交申请'}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>

          {/* 申请记录 */}
          <Card>
            <CardHeader>
              <CardTitle>我的申请记录</CardTitle>
              <CardDescription>
                查看历史申请及审核结果
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-8 text-gray-500">加载中...</div>
              ) : myRequests.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  暂无申请记录
                </div>
              ) : (
                <div className="space-y-4">
                  {myRequests.map((request) => {
                    const config = statusConfig[request.status];
                    const Icon = config.icon;
                    return (
                      <div 
                        key={request.id} 
                        className="border rounded-lg p-4 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">
                            申请成为：{roleLabels[request.requestedRole]}
                          </span>
                          <Badge className={config.color}>
                            <Icon className="h-3 w-3 mr-1" />
                            {config.label}
                          </Badge>
                        </div>
                        <div className="text-sm text-gray-600">
                          <p>申请时间：{format(new Date(request.createdAt), 'yyyy-MM-dd HH:mm')}</p>
                          {request.department && <p>部门：{request.department}</p>}
                          {request.employeeNo && <p>工号：{request.employeeNo}</p>}
                          <p className="mt-2">申请理由：{request.reason}</p>
                        </div>
                        {request.status !== 'pending' && request.reviewedAt && (
                          <div className={`text-sm p-2 rounded ${
                            request.status === 'approved' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                          }`}>
                            <p>审核时间：{format(new Date(request.reviewedAt), 'yyyy-MM-dd HH:mm')}</p>
                            {request.reviewComment && <p>审核意见：{request.reviewComment}</p>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
