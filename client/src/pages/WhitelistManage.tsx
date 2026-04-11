import { useState } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Plus, Upload, Trash2, Download, FileSpreadsheet } from 'lucide-react';
import { toast } from 'sonner';

type UserRole = 'student' | 'teacher' | 'labAdmin' | 'sysAdmin';

export default function WhitelistManage() {
  const utils = trpc.useUtils();

  // 获取白名单列表
  const { data: whitelist = [], isLoading } = trpc.whitelist.getAll.useQuery();

  // 单条添加
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [newEntry, setNewEntry] = useState({
    email: '',
    role: 'teacher' as UserRole,
    name: '',
    department: '',
    employeeNo: '',
  });

  // 批量导入
  const [batchDialogOpen, setBatchDialogOpen] = useState(false);
  const [batchText, setBatchText] = useState('');

  const addMutation = trpc.whitelist.add.useMutation({
    onSuccess: () => {
      toast.success('添加成功');
      setAddDialogOpen(false);
      setNewEntry({ email: '', role: 'teacher', name: '', department: '', employeeNo: '' });
      utils.whitelist.getAll.invalidate();
    },
    onError: (err) => {
      toast.error(`添加失败: ${err.message}`);
    },
  });

  const batchAddMutation = trpc.whitelist.batchAdd.useMutation({
    onSuccess: (result) => {
      toast.success(`批量导入完成: 成功 ${result.successCount} 条，失败 ${result.failCount} 条`);
      setBatchDialogOpen(false);
      setBatchText('');
      utils.whitelist.getAll.invalidate();
    },
    onError: (err) => {
      toast.error(`批量导入失败: ${err.message}`);
    },
  });

  const deleteMutation = trpc.whitelist.delete.useMutation({
    onSuccess: () => {
      toast.success('删除成功');
      utils.whitelist.getAll.invalidate();
    },
    onError: (err) => {
      toast.error(`删除失败: ${err.message}`);
    },
  });

  const handleAddSubmit = () => {
    if (!newEntry.email) {
      toast.error('请填写邮箱');
      return;
    }
    addMutation.mutate(newEntry);
  };

  const handleBatchSubmit = () => {
    if (!batchText.trim()) {
      toast.error('请输入数据');
      return;
    }

    // 解析批量数据：每行格式 email,role,name,department,employeeNo
    const lines = batchText.trim().split('\n').filter(line => line.trim());
    const entries = lines.map(line => {
      const parts = line.split(',').map(s => s.trim());
      return {
        email: parts[0] || '',
        role: (parts[1] as UserRole) || 'teacher',
        name: parts[2] || undefined,
        department: parts[3] || undefined,
        employeeNo: parts[4] || undefined,
      };
    }).filter(e => e.email);

    if (entries.length === 0) {
      toast.error('没有有效数据');
      return;
    }

    batchAddMutation.mutate({ items: entries });
  };

  const handleDelete = (id: number) => {
    if (confirm('确定要删除这条白名单记录吗？')) {
      deleteMutation.mutate({ id });
    }
  };

  const generateTemplate = () => {
    const template = `# 白名单导入模板
# 格式：邮箱,角色,姓名,部门,工号
# 角色可选值：teacher, labAdmin, sysAdmin
# 示例：
zhangsan@example.com,teacher,张三,计算机学院,T001
lisi@example.com,labAdmin,李四,实验中心,A001
wangwu@example.com,teacher,王五,软件学院,T002
`;
    const blob = new Blob([template], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whitelist_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const roleLabels: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    student: { label: '学生', variant: 'outline' },
    teacher: { label: '教师', variant: 'default' },
    labAdmin: { label: '实验室管理员', variant: 'secondary' },
    sysAdmin: { label: '系统管理员', variant: 'destructive' },
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>角色白名单管理</CardTitle>
              <CardDescription>
                预导入教师和管理员邮箱，新用户通过 OAuth 注册时将自动分配对应角色
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={generateTemplate}>
                <Download className="h-4 w-4 mr-2" />
                下载模板
              </Button>
              <Dialog open={batchDialogOpen} onOpenChange={setBatchDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <Upload className="h-4 w-4 mr-2" />
                    批量导入
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>批量导入白名单</DialogTitle>
                    <DialogDescription>
                      每行一条记录，格式：邮箱,角色,姓名,部门,工号（后三项可选）
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <FileSpreadsheet className="h-4 w-4" />
                      <span>支持从 Excel 复制粘贴，或直接输入 CSV 格式数据</span>
                    </div>
                    <Textarea
                      placeholder={`zhangsan@example.com,teacher,张三,计算机学院,T001
lisi@example.com,labAdmin,李四,实验中心,A001`}
                      value={batchText}
                      onChange={(e) => setBatchText(e.target.value)}
                      rows={10}
                      className="font-mono text-sm"
                    />
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setBatchDialogOpen(false)}>
                      取消
                    </Button>
                    <Button 
                      onClick={handleBatchSubmit} 
                      disabled={batchAddMutation.isPending}
                    >
                      {batchAddMutation.isPending ? '导入中...' : '确认导入'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    添加白名单
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>添加白名单</DialogTitle>
                    <DialogDescription>
                      添加教师或管理员邮箱到白名单
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">邮箱 *</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="user@example.com"
                        value={newEntry.email}
                        onChange={(e) => setNewEntry({ ...newEntry, email: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="role">角色 *</Label>
                      <Select
                        value={newEntry.role}
                        onValueChange={(v) => setNewEntry({ ...newEntry, role: v as UserRole })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="teacher">教师</SelectItem>
                          <SelectItem value="labAdmin">实验室管理员</SelectItem>
                          <SelectItem value="sysAdmin">系统管理员</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">姓名</Label>
                      <Input
                        id="name"
                        placeholder="张三"
                        value={newEntry.name}
                        onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="department">部门</Label>
                      <Input
                        id="department"
                        placeholder="计算机学院"
                        value={newEntry.department}
                        onChange={(e) => setNewEntry({ ...newEntry, department: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="employeeNo">工号</Label>
                      <Input
                        id="employeeNo"
                        placeholder="T001"
                        value={newEntry.employeeNo}
                        onChange={(e) => setNewEntry({ ...newEntry, employeeNo: e.target.value })}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
                      取消
                    </Button>
                    <Button onClick={handleAddSubmit} disabled={addMutation.isPending}>
                      {addMutation.isPending ? '添加中...' : '确认添加'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="all">
            <TabsList>
              <TabsTrigger value="all">全部 ({whitelist.length})</TabsTrigger>
              <TabsTrigger value="teacher">
                教师 ({whitelist.filter(w => w.role === 'teacher').length})
              </TabsTrigger>
              <TabsTrigger value="labAdmin">
                实验室管理员 ({whitelist.filter(w => w.role === 'labAdmin').length})
              </TabsTrigger>
              <TabsTrigger value="sysAdmin">
                系统管理员 ({whitelist.filter(w => w.role === 'sysAdmin').length})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="all" className="mt-4">
              <WhitelistTable 
                data={whitelist} 
                roleLabels={roleLabels} 
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="teacher" className="mt-4">
              <WhitelistTable 
                data={whitelist.filter(w => w.role === 'teacher')} 
                roleLabels={roleLabels} 
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="labAdmin" className="mt-4">
              <WhitelistTable 
                data={whitelist.filter(w => w.role === 'labAdmin')} 
                roleLabels={roleLabels} 
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </TabsContent>
            <TabsContent value="sysAdmin" className="mt-4">
              <WhitelistTable 
                data={whitelist.filter(w => w.role === 'sysAdmin')} 
                roleLabels={roleLabels} 
                onDelete={handleDelete}
                isLoading={isLoading}
              />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}

interface WhitelistTableProps {
  data: Array<{
    id: number;
    email: string;
    role: UserRole;
    name: string | null;
    department: string | null;
    employeeNo: string | null;
    createdAt: Date;
  }>;
  roleLabels: Record<UserRole, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }>;
  onDelete: (id: number) => void;
  isLoading: boolean;
}

function WhitelistTable({ data, roleLabels, onDelete, isLoading }: WhitelistTableProps) {
  if (isLoading) {
    return <div className="text-center py-8 text-muted-foreground">加载中...</div>;
  }

  if (data.length === 0) {
    return <div className="text-center py-8 text-muted-foreground">暂无数据</div>;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>邮箱</TableHead>
          <TableHead>角色</TableHead>
          <TableHead>姓名</TableHead>
          <TableHead>部门</TableHead>
          <TableHead>工号</TableHead>
          <TableHead>添加时间</TableHead>
          <TableHead className="w-[80px]">操作</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-mono">{item.email}</TableCell>
            <TableCell>
              <Badge variant={roleLabels[item.role].variant}>
                {roleLabels[item.role].label}
              </Badge>
            </TableCell>
            <TableCell>{item.name || '-'}</TableCell>
            <TableCell>{item.department || '-'}</TableCell>
            <TableCell>{item.employeeNo || '-'}</TableCell>
            <TableCell className="text-muted-foreground">
              {new Date(item.createdAt).toLocaleDateString()}
            </TableCell>
            <TableCell>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDelete(item.id)}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
