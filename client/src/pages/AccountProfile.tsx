import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { User, Mail, Calendar, Shield } from "lucide-react";
import { toast } from "sonner";

const roleNames = {
  student: "学生",
  teacher: "教师",
  labAdmin: "实验室管理员",
  sysAdmin: "系统管理员",
};

const roleBadgeColors = {
  student: "bg-blue-100 text-blue-800",
  teacher: "bg-green-100 text-green-800",
  labAdmin: "bg-purple-100 text-purple-800",
  sysAdmin: "bg-red-100 text-red-800",
};

export default function AccountProfile() {
  const { user, refresh } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");

  const updateMutation = trpc.user.update.useMutation({
    onSuccess: () => {
      toast.success("个人信息已更新");
      refresh();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    updateMutation.mutate({
      id: user.id,
      name: name || undefined,
      email: email || undefined,
    });
  };

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-4 text-gray-600">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">个人信息</h1>
        <p className="text-gray-600 mt-2">管理您的账号信息</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>基本信息</CardTitle>
          <CardDescription>更新您的个人资料</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">
                <User className="h-4 w-4 inline mr-2" />
                姓名
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入姓名"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">
                <Mail className="h-4 w-4 inline mr-2" />
                邮箱
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="请输入邮箱"
              />
            </div>

            <Button type="submit" disabled={updateMutation.isPending}>
              {updateMutation.isPending ? "保存中..." : "保存更改"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>账号信息</CardTitle>
          <CardDescription>查看您的账号详情</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="h-4 w-4" />
              <span>角色</span>
            </div>
            <Badge className={roleBadgeColors[user.role]}>
              {roleNames[user.role]}
            </Badge>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <User className="h-4 w-4" />
              <span>用户 ID</span>
            </div>
            <span className="text-sm font-mono">{user.id}</span>
          </div>

          <div className="flex items-center justify-between py-3 border-b">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>注册时间</span>
            </div>
            <span className="text-sm">
              {new Date(user.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>

          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>最后登录</span>
            </div>
            <span className="text-sm">
              {new Date(user.lastSignedIn).toLocaleString("zh-CN")}
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
