'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { showError, showSuccess } from '@/lib/error-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BookOpen, BarChart3, Settings, UserPlus, Mail, Clock, Award, Building2 } from 'lucide-react';

interface Enterprise {
  has_enterprise: boolean;
  enterprise_id?: string;
  name?: string;
  industry?: string;
  size?: string;
  plan_type?: string;
  role?: string;
  member_count?: number;
  member_limit?: number;
  course_count?: number;
  course_limit?: number;
}

interface Member {
  member_id: string;
  user_id: string;
  email: string;
  nickname: string;
  role: string;
  joined_at: string;
}

interface Course {
  assignment_id: string;
  course_id: string;
  course_name: string;
  is_required: boolean;
  deadline?: string;
}

interface Stats {
  member_count: number;
  active_members: number;
  course_completions: number;
  total_learning_hours: number;
  avg_completion_rate: number;
  activity_rate: number;
}

export default function EnterprisePage() {
  const router = useRouter();
  const { isAuthenticated, isLoading, token, user } = useAuth();

  const [enterprise, setEnterprise] = useState<Enterprise | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  // 创建企业表单
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    industry: '',
    size: 'small',
    contact_email: '',
    plan_type: 'basic'
  });

  // 邀请成员表单
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteEmails, setInviteEmails] = useState('');
  const [inviteRole, setInviteRole] = useState('member');

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  useEffect(() => {
    if (isAuthenticated) {
      loadEnterprise();
    }
  }, [isAuthenticated]);

  async function loadEnterprise() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/my`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return setLoading(false);
      const data = await res.json();

      setEnterprise(data);
      setLoading(false);

      if (data.has_enterprise) {
        loadMembers(data.enterprise_id);
        loadCourses(data.enterprise_id);
        loadStats(data.enterprise_id);
      }
    } catch (err) {
      setLoading(false);
    }
  }

  async function loadMembers(enterpriseId: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/${enterpriseId}/members`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setMembers(data.members || []);
    } catch (err) {}
  }

  async function loadCourses(enterpriseId: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/${enterpriseId}/courses`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setCourses(data.courses || []);
    } catch (err) {}
  }

  async function loadStats(enterpriseId: string) {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/${enterpriseId}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!res.ok) return;
      const data = await res.json();
      setStats(data);
    } catch (err) {}
  }

  async function createEnterprise() {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...createForm,
          contact_email: createForm.contact_email || user?.email
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errData } };
      }
      const data = await res.json();

      setEnterprise({
        has_enterprise: true,
        enterprise_id: data.enterprise_id,
        name: data.name,
        plan_type: data.plan_type,
        role: 'admin'
      });
      setShowCreateForm(false);
      loadMembers(data.enterprise_id);
      loadCourses(data.enterprise_id);
      loadStats(data.enterprise_id);
    } catch (err: any) {
      showError(err);
    }
  }

  async function inviteMembers() {
    if (!enterprise?.enterprise_id) return;

    try {
      const emails = inviteEmails.split(',').map(e => e.trim()).filter(e => e);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/enterprise/${enterprise.enterprise_id}/members/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          enterprise_id: enterprise.enterprise_id,
          emails,
          role: inviteRole
        })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw { response: { status: res.status, data: errData } };
      }
      const data = await res.json();

      showSuccess(`成功邀请 ${data.total_invited} 人`);
      setShowInviteForm(false);
      setInviteEmails('');
      loadMembers(enterprise.enterprise_id);
    } catch (err: any) {
      showError(err);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">加载中...</div>
      </div>
    );
  }

  if (!enterprise?.has_enterprise && !showCreateForm) {
    return (
      <div className="container max-w-lg py-16 text-center">
        <Building2 className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h1 className="text-2xl font-bold mb-2">企业功能</h1>
        <p className="text-gray-600 mb-8">
          创建企业账户，管理团队学习，追踪学习数据
        </p>
        <Button onClick={() => setShowCreateForm(true)}>
          创建企业账户
        </Button>
      </div>
    );
  }

  if (showCreateForm) {
    return (
      <div className="container max-w-md py-8">
        <Card>
          <CardHeader>
            <CardTitle>创建企业账户</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>企业名称</Label>
              <Input value={createForm.name} onChange={e => setCreateForm(prev => ({ ...prev, name: e.target.value }))} />
            </div>
            <div>
              <Label>所属行业</Label>
              <Input value={createForm.industry} onChange={e => setCreateForm(prev => ({ ...prev, industry: e.target.value }))} />
            </div>
            <div>
              <Label>企业规模</Label>
              <select className="w-full border rounded p-2" value={createForm.size} onChange={e => setCreateForm(prev => ({ ...prev, size: e.target.value }))}>
                <option value="small">小型 (10人以下)</option>
                <option value="medium">中型 (10-50人)</option>
                <option value="large">大型 (50人以上)</option>
              </select>
            </div>
            <div>
              <Label>套餐类型</Label>
              <select className="w-full border rounded p-2" value={createForm.plan_type} onChange={e => setCreateForm(prev => ({ ...prev, plan_type: e.target.value }))}>
                <option value="basic">基础版 (最多10人)</option>
                <option value="pro">专业版 (最多50人)</option>
                <option value="enterprise">企业版 (最多200人)</option>
              </select>
            </div>
            <div className="flex gap-4">
              <Button variant="outline" onClick={() => setShowCreateForm(false)}>取消</Button>
              <Button onClick={createEnterprise} disabled={!createForm.name}>创建</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{enterprise?.name}</h1>
          <p className="text-gray-600">
            {enterprise?.industry} | {enterprise?.plan_type}版 | 我的角色: {enterprise?.role}
          </p>
        </div>
        {enterprise?.role === 'admin' && (
          <Button onClick={() => setShowInviteForm(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            邀请成员
          </Button>
        )}
      </div>

      {showInviteForm && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <div className="space-y-4">
              <div>
                <Label>邀请邮箱（多个用逗号分隔）</Label>
                <Input value={inviteEmails} onChange={e => setInviteEmails(e.target.value)} placeholder="email1@example.com, email2@example.com" />
              </div>
              <div>
                <Label>角色</Label>
                <select className="w-full border rounded p-2" value={inviteRole} onChange={e => setInviteRole(e.target.value)}>
                  <option value="member">成员</option>
                  <option value="admin">管理员</option>
                  <option value="viewer">观察者</option>
                </select>
              </div>
              <div className="flex gap-4">
                <Button variant="outline" onClick={() => setShowInviteForm(false)}>取消</Button>
                <Button onClick={inviteMembers} disabled={!inviteEmails}>发送邀请</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <Users className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{stats.member_count}</div>
              <div className="text-sm text-gray-500">团队成员</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Award className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <div className="text-2xl font-bold">{stats.active_members}</div>
              <div className="text-sm text-gray-500">活跃成员</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <BookOpen className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <div className="text-2xl font-bold">{stats.course_completions}</div>
              <div className="text-sm text-gray-500">课程完成</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Clock className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <div className="text-2xl font-bold">{stats.total_learning_hours}</div>
              <div className="text-sm text-gray-500">学习小时</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="members">
        <TabsList>
          <TabsTrigger value="members">成员管理</TabsTrigger>
          <TabsTrigger value="courses">企业课程</TabsTrigger>
          <TabsTrigger value="reports">学习报表</TabsTrigger>
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>团队成员 ({members.length}/{enterprise?.member_limit})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {members.map(m => (
                  <div key={m.member_id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                      <div className="font-medium">{m.nickname || m.email}</div>
                      <div className="text-sm text-gray-500">{m.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-sm px-2 py-1 rounded ${m.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-200'}`}>
                        {m.role}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(m.joined_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="courses" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>企业课程 ({courses.length}/{enterprise?.course_limit})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {courses.map(c => (
                  <Link key={c.assignment_id} href={`/classrooms/${c.course_id}`}>
                    <div className="flex items-center justify-between p-3 bg-gray-50 rounded hover:bg-gray-100">
                      <div>
                        <div className="font-medium">{c.course_name}</div>
                        {c.deadline && (
                          <div className="text-sm text-gray-500">
                            截止: {new Date(c.deadline).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                      {c.is_required && (
                        <span className="text-sm bg-red-100 text-red-700 px-2 py-1 rounded">必修</span>
                      )}
                    </div>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>学习报表</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-500 text-center py-8">
                {enterprise?.role === 'admin' ? '查看详细学习报表请联系管理员' : '只有管理员可查看详细报表'}
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}