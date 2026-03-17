import { useAuth } from "@/_core/hooks/useAuth";
import { useRole } from "@/contexts/RoleContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Shield, Users, GraduationCap, Building2, Save } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const roleInfo = {
  student: { name: '学生', icon: GraduationCap, color: 'text-blue-600' },
  teacher: { name: '教师', icon: Users, color: 'text-green-600' },
  labAdmin: { name: '实验室管理', icon: Building2, color: 'text-purple-600' },
};

export default function PermissionManage() {
  const { user } = useAuth();
  const { isSysAdmin } = useRole();
  const [, setLocation] = useLocation();
  const [activeRole, setActiveRole] = useState<'student' | 'teacher' | 'labAdmin'>('teacher');
  const [permissions, setPermissions] = useState<Record<string, Record<string, boolean>>>({
    student: {},
    teacher: {},
    labAdmin: {},
  });
  const [hasChanges, setHasChanges] = useState(false);

  const { data: permData, isLoading } = trpc.permission.getAll.useQuery();
  const utils = trpc.useUtils();
  
  const updateMutation = trpc.permission.updateRole.useMutation({
    onSuccess: () => {
      toast.success('权限配置已保存');
      setHasChanges(false);
      // 刷新权限数据
      utils.permission.getAll.invalidate();
      utils.permission.myPermissions.invalidate();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  useEffect(() => {
    if (permData?.rolePermissions) {
      setPermissions(permData.rolePermissions as any);
    }
  }, [permData]);

  if (!isSysAdmin) {
    setLocation('/');
    return null;
  }

  const handleToggle = (role: string, code: string, checked: boolean) => {
    setPermissions(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [code]: checked,
      },
    }));
    setHasChanges(true);
  };

  const handleSave = () => {
    const permsToSave = Object.entries(permissions[activeRole]).map(([code, enabled]) => ({
      code,
      enabled,
    }));
    
    // 补充未设置的权限为 false
    const allCodes = permData?.definitions.map(d => d.code) || [];
    for (const code of allCodes) {
      if (!permsToSave.find(p => p.code === code)) {
        permsToSave.push({ code, enabled: false });
      }
    }
    
    updateMutation.mutate({
      role: activeRole,
      permissions: permsToSave,
    });
  };

  const handleSelectAll = () => {
    const allCodes = permData?.definitions.map(d => d.code) || [];
    const newPerms: Record<string, boolean> = {};
    for (const code of allCodes) {
      newPerms[code] = true;
    }
    setPermissions(prev => ({
      ...prev,
      [activeRole]: newPerms,
    }));
    setHasChanges(true);
  };

  const handleClearAll = () => {
    setPermissions(prev => ({
      ...prev,
      [activeRole]: {},
    }));
    setHasChanges(true);
  };

  if (isLoading) {
    return (
      <div className="bg-gray-50 min-h-screen">
        <main className="container py-8">
          <div className="text-center py-12">加载中...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="container py-8">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Shield className="h-8 w-8 text-indigo-600" />
            <h2 className="text-3xl font-bold text-gray-900">权限管理</h2>
          </div>
          <p className="text-gray-600">
            配置不同角色可访问的功能模块。系统管理员始终拥有全部权限。
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>角色权限配置</CardTitle>
            <CardDescription>
              选择角色并勾选该角色可以使用的功能。例如，可以将管理功能授权给教师以减少人员配置。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeRole} onValueChange={(v) => setActiveRole(v as any)}>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <TabsList className="flex-shrink-0">
                  {(['student', 'teacher', 'labAdmin'] as const).map(role => {
                    const info = roleInfo[role];
                    const Icon = info.icon;
                    return (
                      <TabsTrigger key={role} value={role} className="flex items-center gap-1.5 px-4 min-w-[120px] justify-center">
                        <Icon className={`h-4 w-4 ${info.color}`} />
                        <span className="whitespace-nowrap">{info.name}</span>
                      </TabsTrigger>
                    );
                  })}
                </TabsList>

                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={handleSelectAll}>
                    全选
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleClearAll}>
                    清空
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSave}
                    disabled={!hasChanges || updateMutation.isPending}
                    className="flex items-center gap-2"
                  >
                    <Save className="h-4 w-4" />
                    {updateMutation.isPending ? '保存中...' : '保存配置'}
                  </Button>
                </div>
              </div>

              {(['student', 'teacher', 'labAdmin'] as const).map(role => (
                <TabsContent key={role} value={role}>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">启用</TableHead>
                        <TableHead className="w-48">权限名称</TableHead>
                        <TableHead className="w-48">权限代码</TableHead>
                        <TableHead>说明</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {permData?.definitions.map(perm => (
                        <TableRow key={perm.code}>
                          <TableCell>
                            <Checkbox
                              checked={permissions[role]?.[perm.code] || false}
                              onCheckedChange={(checked) => handleToggle(role, perm.code, checked as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-medium">{perm.name}</TableCell>
                          <TableCell>
                            <code className="text-xs bg-gray-100 px-2 py-1 rounded">{perm.code}</code>
                          </TableCell>
                          <TableCell className="text-gray-600">{perm.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TabsContent>
              ))}
            </Tabs>

            {hasChanges && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                您有未保存的更改，请点击"保存配置"按钮保存。
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle>使用说明</CardTitle>
          </CardHeader>
          <CardContent className="text-gray-600 space-y-2">
            <p>• <strong>系统管理员</strong>始终拥有全部权限，无法修改。</p>
            <p>• 如果人员有限，可以将<strong>实验室管理权限</strong>授予教师角色。</p>
            <p>• 权限更改立即生效，用户下次访问相关页面时将应用新权限。</p>
            <p>• 建议谨慎授权<strong>用户管理</strong>和<strong>系统设置</strong>权限。</p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
