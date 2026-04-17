'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, UserPlus, Shield, MoreHorizontal, Ban, Trash2, KeyRound } from 'lucide-react';

interface AdminUser {
  id: string;
  email: string;
  nickname: string;
  is_super_admin: boolean;
  is_active: boolean;
  roles: string[];
  last_login_at: string | null;
  created_at: string;
}

interface Role {
  id: string;
  name: string;
  description: string;
  permissions: string[];
}

export default function AdminManagementPage() {
  const router = useRouter();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRolesModal, setShowRolesModal] = useState<string | null>(null);

  // New admin form state
  const [newEmail, setNewEmail] = useState('');
  const [newNickname, setNewNickname] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedRoles, setSelectedRoles] = useState<string[]>(['viewer']);

  useEffect(() => {
    // Check admin permissions
    const adminInfo = localStorage.getItem('admin_info');
    if (!adminInfo) {
      router.push('/login');
      return;
    }

    const info = JSON.parse(adminInfo);
    if (!info.roles.includes('super_admin') && !info.roles.includes('admin_manager')) {
      // Redirect if no permission
      router.push('/');
      return;
    }

    fetchData();
  }, [router]);

  async function fetchData() {
    setIsLoading(true);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const [adminsRes, rolesRes] = await Promise.all([
        fetch(`${apiUrl}/admin/auth/admins`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${apiUrl}/admin/auth/roles`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);

      if (adminsRes.ok) {
        const data = await adminsRes.json();
        setAdmins(data.admins || []);
      }

      if (rolesRes.ok) {
        const data = await rolesRes.json();
        setRoles(data.roles || []);
      }
    } catch {
      // Use mock data
      setAdmins(getMockAdmins());
      setRoles(getMockRoles());
    } finally {
      setIsLoading(false);
    }
  }

  function getMockAdmins(): AdminUser[] {
    return [
      { id: '1', email: 'admin@openmaic.com', nickname: '超级管理员', is_super_admin: true, is_active: true, roles: ['super_admin'], last_login_at: '2026-04-17 10:00', created_at: '2026-01-01' },
      { id: '2', email: 'content@openmaic.com', nickname: '内容审核员', is_super_admin: false, is_active: true, roles: ['content_manager'], last_login_at: '2026-04-16 14:00', created_at: '2026-02-15' },
      { id: '3', email: 'user@openmaic.com', nickname: '用户管理员', is_super_admin: false, is_active: true, roles: ['user_manager'], last_login_at: '2026-04-15 09:00', created_at: '2026-03-01' },
    ];
  }

  function getMockRoles(): Role[] {
    return [
      { id: '1', name: 'super_admin', description: '超级管理员 - 所有权限', permissions: ['*'] },
      { id: '2', name: 'content_manager', description: '内容管理员', permissions: ['content.list', 'content.approve', 'content.reject'] },
      { id: '3', name: 'user_manager', description: '用户管理员', permissions: ['users.list', 'users.ban', 'users.gift'] },
      { id: '4', name: 'finance_manager', description: '财务管理员', permissions: ['finance.view'] },
      { id: '5', name: 'viewer', description: '观察者', permissions: ['*.view'] },
    ];
  }

  async function handleCreateAdmin() {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      const response = await fetch(`${apiUrl}/admin/auth/admins`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: newEmail,
          password: newPassword,
          nickname: newNickname,
          roles: selectedRoles,
        }),
      });

      if (response.ok) {
        setShowCreateModal(false);
        setNewEmail('');
        setNewNickname('');
        setNewPassword('');
        setSelectedRoles(['viewer']);
        fetchData();
      }
    } catch {
      // Mock success
      setShowCreateModal(false);
      setAdmins([...admins, {
        id: String(admins.length + 1),
        email: newEmail,
        nickname: newNickname,
        is_super_admin: false,
        is_active: true,
        roles: selectedRoles,
        last_login_at: null,
        created_at: new Date().toISOString().split('T')[0],
      }]);
    }
  }

  async function handleDisable(adminId: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      await fetch(`${apiUrl}/admin/auth/admins/${adminId}/disable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchData();
    } catch {
      setAdmins(admins.map(a => a.id === adminId ? { ...a, is_active: false } : a));
    }
  }

  async function handleEnable(adminId: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      await fetch(`${apiUrl}/admin/auth/admins/${adminId}/enable`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      fetchData();
    } catch {
      setAdmins(admins.map(a => a.id === adminId ? { ...a, is_active: true } : a));
    }
  }

  async function handleUpdateRoles(adminId: string) {
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const token = localStorage.getItem('admin_token');

      await fetch(`${apiUrl}/admin/auth/admins/${adminId}/roles`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ admin_id: adminId, roles: selectedRoles }),
      });

      setShowRolesModal(null);
      fetchData();
    } catch {
      setShowRolesModal(null);
      setAdmins(admins.map(a => a.id === adminId ? { ...a, roles: selectedRoles } : a));
    }
  }

  const filteredAdmins = admins.filter(a =>
    a.email.includes(search) || a.nickname.includes(search)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">管理员管理</h1>
        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="搜索管理员"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <UserPlus className="w-4 h-4" />
            添加管理员
          </button>
        </div>
      </div>

      {/* Admin list */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">管理员</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">角色</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">最后登录</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredAdmins.map((admin) => (
              <tr key={admin.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="flex items-center">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm ${
                      admin.is_super_admin ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                    }`}>
                      {admin.nickname?.charAt(0) || 'A'}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{admin.nickname}</div>
                      <div className="text-sm text-gray-500">{admin.email}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1">
                    {admin.is_super_admin && (
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">超管</span>
                    )}
                    {admin.roles.filter(r => r !== 'super_admin').map(role => (
                      <span key={role} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
                        {role}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    admin.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {admin.is_active ? '正常' : '禁用'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">{admin.last_login_at || '-'}</td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {!admin.is_super_admin && (
                      <>
                        <button
                          onClick={() => {
                            setSelectedRoles(admin.roles);
                            setShowRolesModal(admin.id);
                          }}
                          className="p-1 text-gray-400 hover:text-blue-600 rounded"
                          title="修改角色"
                        >
                          <Shield className="w-4 h-4" />
                        </button>
                        {admin.is_active ? (
                          <button
                            onClick={() => handleDisable(admin.id)}
                            className="p-1 text-gray-400 hover:text-red-600 rounded"
                            title="禁用"
                          >
                            <Ban className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEnable(admin.id)}
                            className="p-1 text-gray-400 hover:text-green-600 rounded"
                            title="启用"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {isLoading && <div className="text-center py-8 text-gray-500">加载中...</div>}
        {!isLoading && filteredAdmins.length === 0 && <div className="text-center py-8 text-gray-500">暂无数据</div>}
      </div>

      {/* Create Admin Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">添加管理员</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">昵称</label>
                <input
                  type="text"
                  value={newNickname}
                  onChange={(e) => setNewNickname(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">角色</label>
                <div className="flex flex-wrap gap-2">
                  {roles.filter(r => r.name !== 'super_admin').map(role => (
                    <button
                      key={role.id}
                      onClick={() => {
                        setSelectedRoles(prev =>
                          prev.includes(role.name)
                            ? prev.filter(r => r !== role.name)
                            : [...prev, role.name]
                        );
                      }}
                      className={`px-3 py-1 rounded-full text-sm ${
                        selectedRoles.includes(role.name)
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {role.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={handleCreateAdmin}
                disabled={!newEmail || !newPassword}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                创建
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Roles Modal */}
      {showRolesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">修改角色</h2>
            <div className="space-y-3">
              {roles.filter(r => r.name !== 'super_admin').map(role => (
                <div key={role.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{role.name}</div>
                    <div className="text-xs text-gray-500">{role.description}</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={selectedRoles.includes(role.name)}
                    onChange={(e) => {
                      setSelectedRoles(prev =>
                        e.target.checked
                          ? [...prev, role.name]
                          : prev.filter(r => r !== role.name)
                      );
                    }}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowRolesModal(null)}
                className="px-4 py-2 text-gray-600 hover:text-gray-900"
              >
                取消
              </button>
              <button
                onClick={() => handleUpdateRoles(showRolesModal)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}